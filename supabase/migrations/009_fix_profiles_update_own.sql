-- ============================================================
-- MOS Shift App  009 — profiles 自己更新ポリシーの権限昇格修正
-- ============================================================
-- 目的:
--   スタッフが直接 Supabase API を叩いて自分の role / is_active を
--   書き換えられる脆弱性を DB レベルで修正する。
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → このファイルをペーストして Run
-- ============================================================

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id        = auth.uid()
    -- role と is_active は変更不可（現在値と一致することを強制）
    AND role      = (SELECT role      FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );
