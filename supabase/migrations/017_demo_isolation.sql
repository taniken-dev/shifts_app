-- ============================================================
-- MOS Shift App 017 — デモユーザー隔離
-- ============================================================
-- 目的:
--   ポートフォリオ閲覧者用のデモアカウントを本番データから完全に隔離する。
--   「is_demo = true のユーザーは is_demo = true のデータのみ操作可能」
--   「is_demo = false のユーザーは is_demo = false のデータのみ操作可能」
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → このファイルを貼り付けて Run
--
-- ============================================================


-- ============================================================
-- STEP 1: profiles に is_demo カラムを追加
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_demo IS 'true: ポートフォリオ体験用デモアカウント。本番データとRLSで隔離される。';


-- ============================================================
-- STEP 2: デモ判定ヘルパー関数
--   get_my_role() と同じ設計 — profiles 再帰を避けるため SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_demo FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;


-- ============================================================
-- STEP 3: profiles RLS を再定義（デモ隔離を追加）
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

-- 自分自身は常に参照可（デモ・非デモ問わず）
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- 同じデモ区分のプロフィールのみ参照可
--   デモ管理者 → デモユーザー全員を参照可
--   本番管理者 → 本番ユーザーのみ参照可
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    AND is_demo = public.is_demo_user()
  );

-- 自分自身の更新のみ可（デモユーザーは is_demo を変更不可）
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- is_demo フラグの書き換えを禁止
    AND is_demo = (SELECT is_demo FROM public.profiles WHERE id = auth.uid())
  );

-- 管理者は同じデモ区分のプロフィールのみ更新可
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
    AND is_demo = public.is_demo_user()
  )
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND is_demo = public.is_demo_user()
  );


-- ============================================================
-- STEP 4: shifts RLS を再定義（デモ隔離を追加）
-- ============================================================

DROP POLICY IF EXISTS "shifts_select_own"   ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_own"   ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_own"   ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_own"   ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin" ON public.shifts;

-- 自分のシフトのみ参照可
CREATE POLICY "shifts_select_own"
  ON public.shifts FOR SELECT
  USING (profile_id = auth.uid());

-- 管理者は同じデモ区分のシフトのみ参照可
CREATE POLICY "shifts_select_admin"
  ON public.shifts FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = shifts.profile_id
        AND p.is_demo = public.is_demo_user()
    )
  );

-- 自分のシフトのみ追加可（デモ隔離は profile_id = auth.uid() で自動担保）
CREATE POLICY "shifts_insert_own"
  ON public.shifts FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- 自分の submitted シフトのみ更新可
CREATE POLICY "shifts_update_own"
  ON public.shifts FOR UPDATE
  USING  (profile_id = auth.uid() AND status = 'submitted')
  WITH CHECK (profile_id = auth.uid() AND status = 'submitted');

-- 管理者は同じデモ区分のシフトのみ更新可
CREATE POLICY "shifts_update_admin"
  ON public.shifts FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = shifts.profile_id
        AND p.is_demo = public.is_demo_user()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = shifts.profile_id
        AND p.is_demo = public.is_demo_user()
    )
  );

-- 自分の submitted シフトのみ削除可
CREATE POLICY "shifts_delete_own"
  ON public.shifts FOR DELETE
  USING (profile_id = auth.uid() AND status = 'submitted');

-- 管理者は同じデモ区分のシフトのみ削除可
CREATE POLICY "shifts_delete_admin"
  ON public.shifts FOR DELETE
  USING (
    public.get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = shifts.profile_id
        AND p.is_demo = public.is_demo_user()
    )
  );


-- ============================================================
-- STEP 5: デモアカウントを is_demo = true にマーク
-- ============================================================
-- ※ auth.users にデモアカウントを作成した後に実行してください。
--   下記の email を実際のデモアカウントのメールアドレスに書き換えて実行します。
-- ============================================================

UPDATE public.profiles
SET is_demo = true
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    -- ここに .env.local の NEXT_PUBLIC_DEMO_ADMIN_EMAIL / DEMO_STAFF_EMAIL を記入
    'demo-admin@example.com',
    'demo-staff@example.com'
  )
);


-- ============================================================
-- STEP 6: サンプルシフトデータ（デモ用）
-- ============================================================
-- デモユーザーのシフトデータを追加してポートフォリオで映えるようにします。
-- （auth.users への挿入は Supabase ダッシュボード UI から行うため、
--    ここでは profiles に直接データを注入する方法を示します。）
-- ※ 実際のデモ user UUID に書き換えてください。
-- ============================================================

-- デモスタッフの今月・来月分のシフトサンプル（実行後の確認用）
-- DO $$
-- DECLARE
--   v_admin_id UUID := (SELECT id FROM auth.users WHERE email = 'demo-admin@example.com');
--   v_staff_id UUID := (SELECT id FROM auth.users WHERE email = 'demo-staff@example.com');
--   v_date     DATE;
-- BEGIN
--   FOR i IN 0..13 LOOP
--     v_date := CURRENT_DATE + i;
--     -- スタッフのシフト希望
--     INSERT INTO public.shifts (profile_id, shift_date, start_time, end_time, status)
--     VALUES (v_staff_id, v_date, '09:00', '17:00', 'submitted')
--     ON CONFLICT (profile_id, shift_date) DO NOTHING;
--   END LOOP;
-- END $$;


-- ============================================================
-- STEP 7: 診断クエリ — 実行後に結果を確認してください
-- ============================================================

-- [A] is_demo カラムの確認
SELECT id, staff_code, full_name, role, is_demo
FROM public.profiles
ORDER BY is_demo DESC, role, full_name;

-- [B] 更新されたポリシー一覧
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'shifts')
ORDER BY tablename, policyname;

-- [C] is_demo_user() 関数確認
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'is_demo_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
