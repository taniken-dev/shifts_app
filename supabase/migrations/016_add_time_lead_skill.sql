-- ============================================================
-- MOS Shift App 016 — 「時間帯責任者」スキルの追加
-- ============================================================
-- 目的:
--   1) skills の許可値に「時間帯責任者」を追加
--   2) 既存データで時間帯責任者が付与されている場合に全業務を補完
-- ============================================================

UPDATE public.profiles
SET skills = ARRAY['レジ', 'ドライブスルー', 'カスタマー', 'フライヤー', 'セッター', '仕込み', '時間帯責任者']
WHERE '時間帯責任者' = ANY(skills);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skills_allowed_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skills_allowed_check
  CHECK (
    skills <@ ARRAY['レジ', 'ドライブスルー', 'カスタマー', 'フライヤー', 'セッター', '仕込み', '時間帯責任者']::text[]
  );
