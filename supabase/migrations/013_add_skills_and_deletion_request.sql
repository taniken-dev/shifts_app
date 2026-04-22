-- ============================================================
-- MOS Shift App 013 — 退会申請フラグ / スキル配列の追加
-- ============================================================
-- 目的:
--   1) スタッフの退会申請フローのため profiles.is_deletion_requested を追加
--   2) 習熟度を profiles.skills(text[]) で管理する
--   3) 既存 level / rank 相当データを skills に移行し、旧カラムを廃止
--   4) RLS で一般ユーザーの権限昇格・skills改ざんを防ぎつつ、
--      退会申請のみ自己更新で許可する
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deletion_requested BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.is_deletion_requested IS 'スタッフ本人による退会申請フラグ';
COMMENT ON COLUMN public.profiles.skills IS '習熟スキル配列（レジ/セッター/カウンター/フライヤー/グリル/仕込み/メンテ/閉店作業）';

DO $$
BEGIN
  -- level → skills へ移行
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'level'
  ) THEN
    UPDATE public.profiles
    SET skills = CASE
      WHEN level >= 6 THEN ARRAY['レジ', 'セッター', 'カウンター', 'フライヤー', 'グリル', '仕込み', 'メンテ', '閉店作業']
      WHEN level = 5 THEN ARRAY['レジ', 'セッター', 'カウンター', 'フライヤー', 'グリル']
      WHEN level = 4 THEN ARRAY['レジ', 'セッター', 'カウンター', 'フライヤー']
      WHEN level = 3 THEN ARRAY['レジ', 'セッター', 'カウンター']
      WHEN level = 2 THEN ARRAY['レジ', 'カウンター']
      WHEN level = 1 THEN ARRAY['レジ']
      ELSE COALESCE(skills, '{}')
    END
    WHERE (skills IS NULL OR array_length(skills, 1) IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  -- rank（もし存在すれば）→ skills へ移行
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rank'
  ) THEN
    UPDATE public.profiles
    SET skills = CASE
      WHEN rank ILIKE '%店長%' OR rank ILIKE '%マネージャ%' THEN ARRAY['レジ', 'セッター', 'カウンター', 'フライヤー', 'グリル', '仕込み', 'メンテ', '閉店作業']
      WHEN rank ILIKE '%リーダ%' THEN ARRAY['レジ', 'セッター', 'カウンター', 'フライヤー', 'グリル']
      ELSE COALESCE(skills, '{}')
    END
    WHERE (skills IS NULL OR array_length(skills, 1) IS NULL);
  END IF;
END $$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS level;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS rank;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
    AND is_approved = (SELECT is_approved FROM public.profiles WHERE id = auth.uid())
    AND skills = (SELECT skills FROM public.profiles WHERE id = auth.uid())
    AND (
      is_deletion_requested = (SELECT is_deletion_requested FROM public.profiles WHERE id = auth.uid())
      OR is_deletion_requested = true
    )
  );
