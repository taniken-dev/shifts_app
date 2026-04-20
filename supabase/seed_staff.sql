-- ============================================================
-- テスト用スタッフデータ 30件
-- ============================================================
-- 注意:
--   profiles.id は auth.users.id への FK があるため、
--   session_replication_role = replica で FK チェックを一時バイパスして
--   直接 INSERT する。
--   本番データには絶対に使わないこと。
-- ============================================================

-- FK チェックを一時的に無効化
SET session_replication_role = replica;

INSERT INTO public.profiles
  (id, staff_code, full_name, role, is_active)
VALUES
  (gen_random_uuid(), 'S001', '佐藤 健太',   'staff', true),
  (gen_random_uuid(), 'S002', '鈴木 裕太',   'staff', true),
  (gen_random_uuid(), 'S003', '高橋 大輝',   'staff', true),
  (gen_random_uuid(), 'S004', '田中 拓也',   'staff', true),
  (gen_random_uuid(), 'S005', '伊藤 翔',     'staff', true),
  (gen_random_uuid(), 'S006', '渡辺 直樹',   'staff', true),
  (gen_random_uuid(), 'S007', '山本 海斗',   'staff', true),
  (gen_random_uuid(), 'S008', '中村 蓮',     'staff', true),
  (gen_random_uuid(), 'S009', '小林 颯太',   'staff', true),
  (gen_random_uuid(), 'S010', '加藤 陸',     'staff', true),
  (gen_random_uuid(), 'S011', '吉田 桜',     'staff', true),
  (gen_random_uuid(), 'S012', '山田 美咲',   'staff', true),
  (gen_random_uuid(), 'S013', '佐々木 彩',   'staff', true),
  (gen_random_uuid(), 'S014', '山口 七海',   'staff', true),
  (gen_random_uuid(), 'S015', '松本 結衣',   'staff', true),
  (gen_random_uuid(), 'S016', '井上 菜々子', 'staff', true),
  (gen_random_uuid(), 'S017', '木村 優花',   'staff', true),
  (gen_random_uuid(), 'S018', '林 理沙',     'staff', true),
  (gen_random_uuid(), 'S019', '斎藤 奈々',   'staff', true),
  (gen_random_uuid(), 'S020', '清水 愛',     'staff', true),
  (gen_random_uuid(), 'S021', '中島 大和',   'staff', true),
  (gen_random_uuid(), 'S022', '原田 翔太',   'staff', true),
  (gen_random_uuid(), 'S023', '前田 颯',     'staff', true),
  (gen_random_uuid(), 'S024', '藤田 里奈',   'staff', true),
  (gen_random_uuid(), 'S025', '岡田 真子',   'staff', true),
  (gen_random_uuid(), 'S026', '後藤 涼',     'staff', true),
  (gen_random_uuid(), 'S027', '長谷川 瞬',   'staff', true),
  (gen_random_uuid(), 'S028', '石川 萌',     'staff', true),
  (gen_random_uuid(), 'S029', '橋本 琴音',   'staff', true),
  (gen_random_uuid(), 'S030', '近藤 悠',     'staff', true);

-- FK チェックを元に戻す
SET session_replication_role = DEFAULT;

-- 件数確認
SELECT staff_code, full_name, role, is_active
FROM public.profiles
WHERE staff_code LIKE 'S0%'
ORDER BY staff_code;
