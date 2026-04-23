-- ============================================================
-- MOS Shift App 015 — skills 値を新UIの選択肢に正規化
-- ============================================================
-- 目的:
--   profiles.skills を以下6項目に統一する。
--   レジ / ドライブスルー / カスタマー / フライヤー / セッター / 仕込み
-- ============================================================

UPDATE public.profiles AS p
SET skills = COALESCE((
  SELECT ARRAY(
    SELECT allowed_skill
    FROM unnest(ARRAY['レジ', 'ドライブスルー', 'カスタマー', 'フライヤー', 'セッター', '仕込み']) AS allowed_skill
    WHERE allowed_skill = ANY(
      ARRAY(
        SELECT CASE raw_skill
          WHEN 'ドリンク' THEN 'カスタマー'
          WHEN 'カウンター' THEN 'カスタマー'
          WHEN 'スルー' THEN 'ドライブスルー'
          ELSE raw_skill
        END
        FROM unnest(COALESCE(p.skills, '{}'::text[])) AS raw_skill
      )
    )
  )
), '{}'::text[]);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skills_allowed_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skills_allowed_check
  CHECK (skills <@ ARRAY['レジ', 'ドライブスルー', 'カスタマー', 'フライヤー', 'セッター', '仕込み']::text[]);
