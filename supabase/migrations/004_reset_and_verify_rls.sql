-- ============================================================
-- MOS Shift App  004 — データリセット & RLS 完全再定義
-- ============================================================
-- 目的:
--   未適用の可能性がある 001〜003 の変更をすべて冪等に取り込み、
--   RLS ポリシーをクリーンな状態に再定義する。
--   最後のSELECTで動作を検証できる。
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → このファイルをペーストして Run
-- ============================================================

-- ============================================================
-- STEP 1: shifts テーブルのデータをリセット
-- ============================================================
-- CASCADE は外部キー依存も含めてクリアする
TRUNCATE public.shifts RESTART IDENTITY CASCADE;


-- ============================================================
-- STEP 2: admin_adjusted カラムの追加 (003 が未適用の場合も安全)
-- ============================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS admin_adjusted BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- STEP 3: get_my_role() ヘルパー関数の確実な再作成
-- ============================================================
-- SECURITY DEFINER により RLS をバイパスして role を取得する。
-- profiles ポリシー内で profiles を直接クエリすると無限再帰するため必須。
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;


-- ============================================================
-- STEP 4: profiles の既存ポリシーをすべて削除して再定義
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

-- スタッフ: 自分自身のみ参照
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- 管理者: 全員参照（get_my_role() で再帰を回避）
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- スタッフ: 自分自身のみ更新（role/is_active 変更禁止はアプリ層で担保）
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 管理者: 全員更新
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');


-- ============================================================
-- STEP 5: shifts の既存ポリシーをすべて削除して再定義
-- ============================================================
DROP POLICY IF EXISTS "shifts_select_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_admin"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin"  ON public.shifts;
-- 古い命名規則で作られたポリシーも念のため削除
DROP POLICY IF EXISTS "Admins can view all shifts"  ON public.shifts;
DROP POLICY IF EXISTS "Staff can view own shifts"   ON public.shifts;
DROP POLICY IF EXISTS "Staff can insert own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Staff can update own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Staff can delete own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can update shifts"    ON public.shifts;
DROP POLICY IF EXISTS "Admins can delete shifts"    ON public.shifts;

-- スタッフ: 自分のシフトのみ参照
CREATE POLICY "shifts_select_own"
  ON public.shifts FOR SELECT
  USING (profile_id = auth.uid());

-- 管理者: 全シフト参照（get_my_role() で再帰を回避）
CREATE POLICY "shifts_select_admin"
  ON public.shifts FOR SELECT
  USING (public.get_my_role() = 'admin');

-- スタッフ: 自分のシフトのみ追加（profile_id 偽装不可）
CREATE POLICY "shifts_insert_own"
  ON public.shifts FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- スタッフ: submitted 状態の自分のシフトのみ更新可
CREATE POLICY "shifts_update_own"
  ON public.shifts FOR UPDATE
  USING  (profile_id = auth.uid() AND status = 'submitted')
  WITH CHECK (profile_id = auth.uid() AND status = 'submitted');

-- 管理者: 全シフト更新（承認/却下/時間調整）
CREATE POLICY "shifts_update_admin"
  ON public.shifts FOR UPDATE
  USING  (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- スタッフ: submitted 状態の自分のシフトのみ削除可
CREATE POLICY "shifts_delete_own"
  ON public.shifts FOR DELETE
  USING (profile_id = auth.uid() AND status = 'submitted');

-- 管理者: 全シフト削除
CREATE POLICY "shifts_delete_admin"
  ON public.shifts FOR DELETE
  USING (public.get_my_role() = 'admin');


-- ============================================================
-- STEP 6: RLS が有効になっているか確認
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 7: 診断クエリ — 実行後に結果を確認してください
-- ============================================================

-- [A] 現在のポリシー一覧
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'shifts')
ORDER BY tablename, policyname;

-- [B] shifts テーブルのカラム確認（admin_adjusted が存在するか）
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'shifts'
ORDER BY ordinal_position;

-- [C] profiles の件数・ロール分布
SELECT role, COUNT(*) AS count FROM public.profiles GROUP BY role;

-- [D] get_my_role() 関数の確認
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'get_my_role'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
