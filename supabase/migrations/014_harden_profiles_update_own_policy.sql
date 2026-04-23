-- ============================================================
-- MOS Shift App 014 — profiles_update_own の権限固定を強化
-- ============================================================
-- 目的:
--   一般ユーザーが自己更新時に is_approved / role / is_active / skills を
--   変更できないことを DB レベルで明示的に固定する。
--   退会申請フラグのみ false -> true を許可する。
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_active FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_is_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_approved FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_skills()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT skills FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_is_deletion_requested()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_deletion_requested FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.get_my_profile_role()
    AND is_active = public.get_my_profile_is_active()
    AND is_approved = public.get_my_profile_is_approved()
    AND skills = public.get_my_profile_skills()
    AND (
      is_deletion_requested = public.get_my_profile_is_deletion_requested()
      OR (
        public.get_my_profile_is_deletion_requested() = false
        AND is_deletion_requested = true
      )
    )
  );
