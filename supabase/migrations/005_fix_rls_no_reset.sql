-- ============================================================
-- MOS Shift App  005 — RLS ポリシー再定義（データ保持版）
-- ============================================================
-- 目的:
--   既存データを削除せずに RLS ポリシーと補助関数を再定義する。
--   004 の TRUNCATE が不要な場合はこちらを使用すること。
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → このファイルをペーストして Run
-- ============================================================


-- ============================================================
-- STEP 1: admin_adjusted カラムの追加（未適用の場合も安全）
-- ============================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS admin_adjusted BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- STEP 2: get_my_role() ヘルパー関数の再作成
-- ============================================================
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
-- STEP 3: profiles の既存ポリシーをすべて削除して再定義
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');


-- ============================================================
-- STEP 4: shifts の既存ポリシーをすべて削除して再定義
-- ============================================================
DROP POLICY IF EXISTS "shifts_select_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_admin"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin"  ON public.shifts;
DROP POLICY IF EXISTS "Admins can view all shifts"  ON public.shifts;
DROP POLICY IF EXISTS "Staff can view own shifts"   ON public.shifts;
DROP POLICY IF EXISTS "Staff can insert own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Staff can update own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Staff can delete own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can update shifts"    ON public.shifts;
DROP POLICY IF EXISTS "Admins can delete shifts"    ON public.shifts;

CREATE POLICY "shifts_select_own"
  ON public.shifts FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "shifts_select_admin"
  ON public.shifts FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "shifts_insert_own"
  ON public.shifts FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "shifts_update_own"
  ON public.shifts FOR UPDATE
  USING  (profile_id = auth.uid() AND status = 'submitted')
  WITH CHECK (profile_id = auth.uid() AND status = 'submitted');

CREATE POLICY "shifts_update_admin"
  ON public.shifts FOR UPDATE
  USING  (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "shifts_delete_own"
  ON public.shifts FOR DELETE
  USING (profile_id = auth.uid() AND status = 'submitted');

CREATE POLICY "shifts_delete_admin"
  ON public.shifts FOR DELETE
  USING (public.get_my_role() = 'admin');


-- ============================================================
-- STEP 5: RLS が有効か確認・有効化
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 6: 診断クエリ — 実行後に結果を確認してください
-- ============================================================

-- [A] ポリシー一覧
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'shifts')
ORDER BY tablename, policyname;

-- [B] shifts カラム確認（admin_adjusted があるか）
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'shifts'
ORDER BY ordinal_position;

-- [C] get_my_role() 関数確認
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'get_my_role'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
