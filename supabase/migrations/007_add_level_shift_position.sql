-- ============================================================
-- MOS Shift App  007 — 習熟度レベル & シフトポジション
-- ============================================================

-- profiles に習熟度レベル追加（管理者のみ閲覧）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level INTEGER CHECK (level BETWEEN 1 AND 6);

-- shifts にポジション追加（スタッフにも公開）
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS position TEXT;

-- 確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('profiles','shifts')
ORDER BY table_name, ordinal_position;
