-- ============================================================
-- MOS Shift App 018 — デモユーザー用シフトシードデータ
-- ============================================================
-- 目的:
--   ポートフォリオ閲覧者がデモログイン直後から
--   リアルなシフトデータを見られるようにする。
--
-- 安全性:
--   - profile_id はデモユーザーの UUID に限定されるため、
--     本番 shifts との UNIQUE(profile_id, shift_date) 競合は
--     物理的に発生しない。
--   - is_demo = true の RLS により、デモユーザーは
--     本番データを読み書きできない。
--   - ON CONFLICT DO NOTHING で冪等（何度実行しても安全）。
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor → 貼り付けて Run
--   ※ 017_demo_isolation.sql を先に実行しておくこと
-- ============================================================

DO $$
DECLARE
  v_admin_id  UUID;
  v_staff_id  UUID;
  v_date      DATE;
  i           INT;

  -- デモアカウントのメールアドレス（.env.local と合わせること）
  c_admin_email CONSTANT TEXT := 'demo-admin@example.com';
  c_staff_email CONSTANT TEXT := 'demo-staff@example.com';
BEGIN

  -- ── UUIDを取得 ──────────────────────────────────────────
  SELECT id INTO v_admin_id FROM auth.users WHERE email = c_admin_email;
  SELECT id INTO v_staff_id FROM auth.users WHERE email = c_staff_email;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'デモ管理者アカウントが見つかりません: %', c_admin_email;
  END IF;
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'デモスタッフアカウントが見つかりません: %', c_staff_email;
  END IF;

  -- ── スタッフのシフト希望（今月 + 来月 の平日を中心に） ──────
  -- パターン: 月～金は 09:00-17:00、土は 10:00-15:00、日は休み
  FOR i IN 0..59 LOOP
    v_date := DATE_TRUNC('month', CURRENT_DATE)::DATE + i;

    -- 日曜はスキップ
    IF EXTRACT(DOW FROM v_date) = 0 THEN CONTINUE; END IF;

    IF EXTRACT(DOW FROM v_date) = 6 THEN
      -- 土曜: 短時間シフト
      INSERT INTO public.shifts (profile_id, shift_date, start_time, end_time, status, note)
      VALUES (
        v_staff_id,
        v_date,
        '10:00', '15:00',
        'submitted',
        NULL
      )
      ON CONFLICT (profile_id, shift_date) DO NOTHING;
    ELSE
      -- 月〜金: フルシフト（隔週で午後シフトを混ぜてリアル感を出す）
      INSERT INTO public.shifts (profile_id, shift_date, start_time, end_time, status, note)
      VALUES (
        v_staff_id,
        v_date,
        CASE WHEN i % 7 = 3 THEN '13:00' ELSE '09:00' END,
        CASE WHEN i % 7 = 3 THEN '21:00' ELSE '17:00' END,
        -- 過去日は approved、未来は submitted にしてフローが見えるようにする
        CASE WHEN v_date < CURRENT_DATE THEN 'approved' ELSE 'submitted' END,
        CASE WHEN i % 11 = 0 THEN '遅刻します' ELSE NULL END
      )
      ON CONFLICT (profile_id, shift_date) DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'デモシフトデータの挿入が完了しました (staff: %)', v_staff_id;
END $$;


-- ── 確認クエリ ──────────────────────────────────────────────
SELECT
  s.shift_date,
  s.start_time,
  s.end_time,
  s.status,
  s.note,
  p.full_name,
  p.is_demo
FROM public.shifts s
JOIN public.profiles p ON p.id = s.profile_id
WHERE p.is_demo = true
ORDER BY s.shift_date;
