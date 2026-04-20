-- ============================================================
-- MOS Shift App  008 — 承認済みシフトの全員参照ポリシー追加
-- ============================================================
-- 目的:
--   status = 'approved' のシフトを、認証済みユーザー全員が
--   SELECT できるようにする（設計仕様 ③ の実装）。
--   既存ポリシーはすべてそのまま維持する。
--
-- 影響範囲:
--   - 管理者画面は createServiceRoleClient() を使用しているため影響なし
--   - スタッフ画面は profile_id = auth.uid() でフィルター済みのため影響なし
--   - UI から他スタッフの承認済みシフトが表示される画面は存在しない
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → このファイルをペーストして Run
-- ============================================================

DROP POLICY IF EXISTS "shifts_select_approved_public" ON public.shifts;

CREATE POLICY "shifts_select_approved_public"
  ON public.shifts FOR SELECT
  USING (status = 'approved');
