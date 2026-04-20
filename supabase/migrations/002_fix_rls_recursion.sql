-- ============================================================
-- MOS Shift App - RLS 無限再帰バグ修正
-- ============================================================
-- 原因:
--   profiles テーブルのポリシー内で profiles を再クエリしており
--   RLS が再帰的に発動して無限ループになる。
--
-- 修正方針:
--   SECURITY DEFINER 関数 get_my_role() を作成し、
--   RLS をバイパスして自分の role だけを取得できるようにする。
--   全ポリシーのサブクエリをこの関数に置き換える。
-- ============================================================

-- ------------------------------------------------------------
-- 1. ロール取得用ヘルパー関数（RLS をバイパス）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE          -- セッション内でキャッシュ可能
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ------------------------------------------------------------
-- 2. 既存ポリシーを全て削除して再作成
-- ------------------------------------------------------------

-- ---- profiles ----
DROP POLICY IF EXISTS "profiles_select_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"  ON public.profiles;

-- スタッフ: 自分のみ参照
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- 管理者: 全件参照（get_my_role() で再帰を回避）
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- スタッフ: 自分のみ更新
--   role / is_active の変更禁止はアプリ層（API Route）で担保する。
--   WITH CHECK 内でのself-joinも再帰を起こすため、ここでは行レベルの所有権のみ保証。
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 管理者: 全件更新
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ---- shifts ----
DROP POLICY IF EXISTS "shifts_select_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_admin"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_own"    ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin"  ON public.shifts;

-- スタッフ: 自分のシフトのみ参照
CREATE POLICY "shifts_select_own"
  ON public.shifts FOR SELECT
  USING (profile_id = auth.uid());

-- 管理者: 全シフト参照
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
  USING (profile_id = auth.uid() AND status = 'submitted')
  WITH CHECK (profile_id = auth.uid() AND status = 'submitted');

-- 管理者: 全シフト更新（承認/却下）
CREATE POLICY "shifts_update_admin"
  ON public.shifts FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- スタッフ: submitted 状態の自分のシフトのみ削除可
CREATE POLICY "shifts_delete_own"
  ON public.shifts FOR DELETE
  USING (profile_id = auth.uid() AND status = 'submitted');

-- 管理者: 全シフト削除
CREATE POLICY "shifts_delete_admin"
  ON public.shifts FOR DELETE
  USING (public.get_my_role() = 'admin');
