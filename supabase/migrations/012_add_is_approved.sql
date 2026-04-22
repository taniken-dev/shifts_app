-- ============================================================
-- MOS Shift App 012 — profiles に承認フラグを追加
-- ============================================================
-- 目的:
--   LINE ログイン後に管理者承認されるまでアプリ利用を制限するため、
--   profiles.is_approved を導入する。
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → このファイルをペーストして Run
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_approved IS '管理者承認フラグ。true のユーザーのみアプリ利用可。';

-- 既存管理者は運用継続のため承認済み扱いにする
UPDATE public.profiles
SET is_approved = true
WHERE role = 'admin';

-- 一般ユーザーが自己更新で is_approved を書き換えられないように固定する
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
    AND is_approved = (SELECT is_approved FROM public.profiles WHERE id = auth.uid())
  );
