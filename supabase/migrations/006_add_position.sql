-- ============================================================
-- MOS Shift App  006 — profiles に position カラム追加
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT;

-- 確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
