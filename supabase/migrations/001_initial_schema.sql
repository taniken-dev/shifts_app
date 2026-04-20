-- ============================================================
-- MOS Shift App - Initial Schema
-- ============================================================
-- 実行順序:
--   1. テーブル作成
--   2. インデックス
--   3. RLSポリシー
--   4. トリガー
-- ============================================================

-- ------------------------------------------------------------
-- 拡張機能
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. profiles テーブル
--    auth.users を拡張し、スタッフ情報を保持する
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_code  TEXT        NOT NULL,          -- 店舗内スタッフ番号 (例: "S001")
  full_name   TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'staff'
                          CHECK (role IN ('staff', 'admin')),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_staff_code_unique UNIQUE (staff_code)
);

COMMENT ON TABLE  public.profiles              IS 'auth.users の拡張。スタッフ属性と権限ロールを管理する。';
COMMENT ON COLUMN public.profiles.staff_code   IS '店舗内の識別コード。ログイン補助にも使用。';
COMMENT ON COLUMN public.profiles.role         IS 'staff: 一般スタッフ / admin: 店長・管理者';

-- ------------------------------------------------------------
-- 2. shifts テーブル
--    スタッフが提出するシフト希望を格納する
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_date  DATE        NOT NULL,
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  note        TEXT,                          -- 任意備考 (最大 500 文字)
  status      TEXT        NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT shifts_pkey              PRIMARY KEY (id),
  -- 同一スタッフが同じ日に複数の希望を出せないようにする
  CONSTRAINT shifts_no_dup_per_day    UNIQUE (profile_id, shift_date),
  -- 終了 > 開始 を DB レベルで保証
  CONSTRAINT shifts_valid_time_range  CHECK (end_time > start_time),
  -- note は 500 文字以内
  CONSTRAINT shifts_note_length       CHECK (char_length(note) <= 500)
);

COMMENT ON TABLE  public.shifts             IS 'スタッフのシフト希望。1スタッフ1日1レコード。';
COMMENT ON COLUMN public.shifts.status      IS 'submitted: 提出済 / approved: 承認済 / rejected: 却下';

-- ------------------------------------------------------------
-- 3. インデックス
-- ------------------------------------------------------------
-- シフト一覧のよくある検索パターンに合わせて最適化
CREATE INDEX IF NOT EXISTS idx_shifts_profile_id   ON public.shifts (profile_id);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_date   ON public.shifts (shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_status       ON public.shifts (status);
-- 管理者が期間絞り込みする際に有効
CREATE INDEX IF NOT EXISTS idx_shifts_date_profile ON public.shifts (shift_date, profile_id);

-- ------------------------------------------------------------
-- 4. updated_at 自動更新トリガー
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------
-- 5. 新規ユーザー登録時に profiles レコードを自動生成するトリガー
--    auth.users への INSERT に反応して profiles を作成する
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, staff_code, full_name, role)
  VALUES (
    NEW.id,
    -- staff_code は管理者が後から設定するまで仮の値を入れる
    'PENDING-' || substr(NEW.id::TEXT, 1, 8),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '未設定'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts   ENABLE ROW LEVEL SECURITY;

-- ---- ロール取得ヘルパー関数 ----
-- profiles ポリシー内で profiles を再クエリすると無限再帰が発生するため、
-- SECURITY DEFINER 関数で RLS をバイパスして role を取得する。
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ---- profiles ポリシー ----

-- スタッフ: 自分自身のプロフィールのみ参照可
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- 管理者: 全プロフィール参照可
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- スタッフ: 自分自身の情報のみ更新可
--   role / is_active の変更禁止はアプリ層（API Route）で担保する
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 管理者: 全プロフィール更新可
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---- shifts ポリシー ----

-- スタッフ: 自分のシフトのみ参照可
CREATE POLICY "shifts_select_own"
  ON public.shifts FOR SELECT
  USING (profile_id = auth.uid());

-- 管理者: 全シフト参照可
CREATE POLICY "shifts_select_admin"
  ON public.shifts FOR SELECT
  USING (public.get_my_role() = 'admin');

-- スタッフ: 自分のシフトのみ追加可 (profile_id を偽装不可)
CREATE POLICY "shifts_insert_own"
  ON public.shifts FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- スタッフ: 自分の "submitted" 状態のシフトのみ更新可
CREATE POLICY "shifts_update_own"
  ON public.shifts FOR UPDATE
  USING (profile_id = auth.uid() AND status = 'submitted')
  WITH CHECK (profile_id = auth.uid() AND status = 'submitted');

-- 管理者: シフトの status を変更可（承認/却下）
CREATE POLICY "shifts_update_admin"
  ON public.shifts FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- スタッフ: 自分の "submitted" シフトのみ削除可
CREATE POLICY "shifts_delete_own"
  ON public.shifts FOR DELETE
  USING (profile_id = auth.uid() AND status = 'submitted');

-- 管理者: 全シフト削除可
CREATE POLICY "shifts_delete_admin"
  ON public.shifts FOR DELETE
  USING (public.get_my_role() = 'admin');
