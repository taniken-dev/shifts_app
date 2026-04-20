-- ============================================================
-- MOS Shift App - Seed Data (開発・ステージング用)
-- 本番環境では絶対に実行しないこと
-- ============================================================

-- 管理者ユーザーを Supabase Auth に追加した後、
-- 以下のクエリで profiles の role を admin に昇格させる。
-- (UUIDは実際に auth.users に存在するものに差し替える)

-- UPDATE public.profiles
-- SET role = 'admin', staff_code = 'ADM001', full_name = '店長 太郎'
-- WHERE id = '<管理者のauth.users UUID>';

-- サンプルスタッフ (auth.users 側は Supabase コンソールまたは管理APIで作成)
-- INSERT INTO public.profiles (id, staff_code, full_name, role)
-- VALUES
--   ('<UUID-1>', 'S001', '鈴木 花子', 'staff'),
--   ('<UUID-2>', 'S002', '田中 一郎', 'staff'),
--   ('<UUID-3>', 'S003', '佐藤 美咲', 'staff');

-- サンプルシフト希望
-- INSERT INTO public.shifts (profile_id, shift_date, start_time, end_time, note)
-- VALUES
--   ('<UUID-1>', '2026-04-14', '10:00', '15:00', 'テスト期間中なので午後のみ'),
--   ('<UUID-2>', '2026-04-14', '17:00', '22:00', NULL),
--   ('<UUID-3>', '2026-04-15', '09:00', '14:00', NULL);
