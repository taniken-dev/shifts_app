-- ============================================================
-- テスト用シフト希望データ — 2026年4月（ペルソナ別・バラつき版）
-- ============================================================
--
-- ペルソナ割り当て
--   S001-S010 (10名): 主婦・フリーター層  — 平日朝〜昼 / 土日（◎含む）
--   S011-S025 (15名): 学生・ダブルワーク層 — 平日夕方 / 土日朝昼（◎含む）
--   S026-S030 ( 5名): フルタイム層        — 週5日・長時間(◎含む)
--
-- ◎ = is_open_start AND is_open_end:  9:00〜閉店まで終日対応可
-- 〇end (is_open_end=true):           XX:XX〜閉店(22:00 stored)
-- 〇start (is_open_start=true):       オープン(09:00 stored)から対応可
--
-- 全パターンは実シフト表から抽出した SHIFT_CATALOG に準拠:
--   朝〜ランチ: 09-14, 09-15, 09-16, 09-17, 10-15, 10-16, 11-15, 11-16, 11-17
--   夕方(〇end): 14〇, 16〇, 17〇
--
-- 2026年4月の祝日: 4/29（昭和の日・水）
-- 週3〜5日の希望になるよう出勤確率を調整
-- ============================================================

-- 既存データをクリア
DELETE FROM public.shifts
WHERE shift_date BETWEEN '2026-04-01' AND '2026-04-30';


-- ============================================================
-- ペルソナ1: 主婦・フリーター層 (S001-S010)
-- 平日中心・朝〜昼の 4〜8h（SHIFT_CATALOGの朝ランチ帯を使用）
-- 月〜金: 55%  /  土日: 12%  /  祝日(4/29): 20%  → 約3日/週
-- ============================================================
INSERT INTO public.shifts
  (profile_id, shift_date, start_time, end_time, is_open_start, is_open_end, note, status)
SELECT
  p.id,
  d.dt,
  tp.s,
  tp.e,
  tp.os,
  tp.oe,
  CASE WHEN random() < 0.10
    THEN (ARRAY[
      '子供の送迎があるため早めに上がりたいです',
      'この日は早めに上がれると助かります',
      '午後は都合が悪いです',
      '用事があるため時間厳守でお願いします'
    ])[ceil(random() * 4)::int]
  END                AS note,
  'submitted'        AS status
FROM
  public.profiles p
  CROSS JOIN (
    SELECT generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day'::interval)::date AS dt
  ) d
  -- 12パターン: 全て実シフト表のカタログに準拠、is_open_startあり
  CROSS JOIN LATERAL (
    SELECT
      (ARRAY[
        '09:00'::time,  --  1: 09〜14 (5h)
        '09:00'::time,  --  2: 09〜14 (5h) ×repeat
        '09:00'::time,  --  3: 09〜15 (6h)
        '09:00'::time,  --  4: 09〜15 (6h) ×repeat
        '09:00'::time,  --  5: 09〜16 (7h)
        '10:00'::time,  --  6: 10〜15 (5h)
        '10:00'::time,  --  7: 10〜15 (5h) ×repeat
        '10:00'::time,  --  8: 10〜16 (6h)
        '11:00'::time,  --  9: 11〜15 (4h)
        '11:00'::time,  -- 10: 11〜15 (4h) ×repeat
        '11:00'::time,  -- 11: 11〜16 (5h)
        '11:00'::time   -- 12: 11〜17 (6h)
      ])[n] AS s,
      (ARRAY[
        '14:00'::time,  --  1
        '14:00'::time,  --  2
        '15:00'::time,  --  3
        '15:00'::time,  --  4
        '16:00'::time,  --  5
        '15:00'::time,  --  6
        '15:00'::time,  --  7
        '16:00'::time,  --  8
        '15:00'::time,  --  9
        '15:00'::time,  -- 10
        '16:00'::time,  -- 11
        '17:00'::time   -- 12
      ])[n] AS e,
      -- パターン2・4 は 〇start（オープンから対応可）
      (ARRAY[false, true, false, true, false, false, false, false, false, false, false, false])[n] AS os,
      (ARRAY[false,false,false,false,false,false,false,false,false,false,false,false])[n]          AS oe
    FROM (SELECT ceil(random() * 12)::int AS n) r
  ) tp
WHERE
  p.role = 'staff' AND p.is_active = true
  AND p.staff_code BETWEEN 'S001' AND 'S010'
  AND (
    (EXTRACT(DOW FROM d.dt) BETWEEN 1 AND 5 AND d.dt != '2026-04-29' AND random() < 0.55)
    OR (d.dt = '2026-04-29' AND random() < 0.20)
  )
ON CONFLICT (profile_id, shift_date) DO NOTHING;


-- ============================================================
-- ペルソナ1: 主婦・フリーター層 (S001-S010) — 土日シフト（◎含む）
-- 土日: 12% / 8パターン（朝〜昼 × 7 + ◎ × 1）
-- ============================================================
INSERT INTO public.shifts
  (profile_id, shift_date, start_time, end_time, is_open_start, is_open_end, note, status)
SELECT
  p.id,
  d.dt,
  tp.s,
  tp.e,
  tp.os,
  tp.oe,
  NULL               AS note,
  'submitted'        AS status
FROM
  public.profiles p
  CROSS JOIN (
    SELECT generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day'::interval)::date AS dt
  ) d
  -- 8パターン: 朝〜昼×7 + ◎×1（終日空いている場合）
  CROSS JOIN LATERAL (
    SELECT
      (ARRAY[
        '09:00'::time,  --  1: 09〜14 (5h)
        '09:00'::time,  --  2: 09〜15 (6h)
        '09:00'::time,  --  3: 09〜16 (7h)
        '10:00'::time,  --  4: 10〜15 (5h)
        '10:00'::time,  --  5: 10〜16 (6h)
        '11:00'::time,  --  6: 11〜15 (4h)
        '11:00'::time,  --  7: 11〜16 (5h)
        '09:00'::time   --  8: ◎ 終日（is_open_start + is_open_end）
      ])[n] AS s,
      (ARRAY[
        '14:00'::time,  --  1
        '15:00'::time,  --  2
        '16:00'::time,  --  3
        '15:00'::time,  --  4
        '16:00'::time,  --  5
        '15:00'::time,  --  6
        '16:00'::time,  --  7
        '22:00'::time   --  8 (◎)
      ])[n] AS e,
      (ARRAY[false,false,false,false,false,false,false, true])[n] AS os,
      (ARRAY[false,false,false,false,false,false,false, true])[n] AS oe
    FROM (SELECT ceil(random() * 8)::int AS n) r
  ) tp
WHERE
  p.role = 'staff' AND p.is_active = true
  AND p.staff_code BETWEEN 'S001' AND 'S010'
  AND EXTRACT(DOW FROM d.dt) IN (0, 6)
  AND random() < 0.12
ON CONFLICT (profile_id, shift_date) DO NOTHING;


-- ============================================================
-- ペルソナ2: 学生・ダブルワーク層 (S011-S025) — 平日夕方シフト
-- 月〜金（祝除く）: 14〇/16〇/17〇（全て is_open_end）
-- 出勤確率: 40%（週 1〜2 日）
-- ============================================================
INSERT INTO public.shifts
  (profile_id, shift_date, start_time, end_time, is_open_start, is_open_end, note, status)
SELECT
  p.id,
  d.dt,
  tp.s,
  tp.e,
  false  AS os,
  true   AS oe,
  CASE WHEN random() < 0.14
    THEN (ARRAY[
      '授業の都合でこの時間しか入れません',
      '他のバイトと被るため終了時間は厳守でお願いします',
      '少し遅れる可能性があります',
      'テスト期間中のためこの日のみ早め終了を希望します'
    ])[ceil(random() * 4)::int]
  END                AS note,
  'submitted'        AS status
FROM
  public.profiles p
  CROSS JOIN (
    SELECT generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day'::interval)::date AS dt
  ) d
  -- 10パターン: 全て is_open_end（22:00 stored）— 実シフト表の「17〇」「16〇」「14〇」
  --   17〇 が最多（60%）、16〇 が次（30%）、14〇 が少数（10%）
  CROSS JOIN LATERAL (
    SELECT
      (ARRAY[
        '17:00'::time,  --  1: 17〇 (最多)
        '17:00'::time,  --  2: 17〇
        '17:00'::time,  --  3: 17〇
        '17:00'::time,  --  4: 17〇
        '17:00'::time,  --  5: 17〇
        '17:00'::time,  --  6: 17〇
        '16:00'::time,  --  7: 16〇
        '16:00'::time,  --  8: 16〇
        '16:00'::time,  --  9: 16〇
        '14:00'::time   -- 10: 14〇
      ])[n] AS s,
      '22:00'::time AS e  -- is_open_end=true のとき 22:00 で統一
    FROM (SELECT ceil(random() * 10)::int AS n) r
  ) tp
WHERE
  p.role = 'staff' AND p.is_active = true
  AND p.staff_code BETWEEN 'S011' AND 'S025'
  AND EXTRACT(DOW FROM d.dt) BETWEEN 1 AND 5
  AND d.dt != '2026-04-29'
  AND random() < 0.40
ON CONFLICT (profile_id, shift_date) DO NOTHING;


-- ============================================================
-- ペルソナ2: 学生・ダブルワーク層 (S011-S025) — 土日・祝日（朝〜昼）
-- 出勤確率: 65%（土日は積極的に入る）→ 約3〜4日/月
-- ============================================================
INSERT INTO public.shifts
  (profile_id, shift_date, start_time, end_time, is_open_start, is_open_end, note, status)
SELECT
  p.id,
  d.dt,
  tp.s,
  tp.e,
  tp.os,
  tp.oe,
  CASE WHEN random() < 0.09
    THEN '土日は比較的長めに入れます'
  END                AS note,
  'submitted'        AS status
FROM
  public.profiles p
  CROSS JOIN (
    SELECT generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day'::interval)::date AS dt
  ) d
  -- 11パターン: 朝〜昼帯（catalog準拠）× 10 + ◎ × 1
  CROSS JOIN LATERAL (
    SELECT
      (ARRAY[
        '09:00'::time,  --  1: 09〜14 (5h)
        '09:00'::time,  --  2: 09〜14 (5h) ×repeat
        '09:00'::time,  --  3: 09〜15 (6h)
        '09:00'::time,  --  4: 09〜15 (6h) 〇start
        '10:00'::time,  --  5: 10〜15 (5h)
        '10:00'::time,  --  6: 10〜15 (5h) ×repeat
        '10:00'::time,  --  7: 10〜16 (6h)
        '11:00'::time,  --  8: 11〜15 (4h)
        '11:00'::time,  --  9: 11〜15 (4h) ×repeat
        '11:00'::time,  -- 10: 11〜16 (5h)
        '09:00'::time   -- 11: ◎ 終日（is_open_start + is_open_end）
      ])[n] AS s,
      (ARRAY[
        '14:00'::time,  --  1
        '14:00'::time,  --  2
        '15:00'::time,  --  3
        '15:00'::time,  --  4
        '15:00'::time,  --  5
        '15:00'::time,  --  6
        '16:00'::time,  --  7
        '15:00'::time,  --  8
        '15:00'::time,  --  9
        '16:00'::time,  -- 10
        '22:00'::time   -- 11 (◎)
      ])[n] AS e,
      -- パターン4・11 は 〇start / ◎
      (ARRAY[false,false,false, true,false,false,false,false,false,false, true])[n] AS os,
      -- パターン11(◎)のみ is_open_end=true
      (ARRAY[false,false,false,false,false,false,false,false,false,false, true])[n] AS oe
    FROM (SELECT ceil(random() * 11)::int AS n) r
  ) tp
WHERE
  p.role = 'staff' AND p.is_active = true
  AND p.staff_code BETWEEN 'S011' AND 'S025'
  AND (
    EXTRACT(DOW FROM d.dt) IN (0, 6)
    OR d.dt = '2026-04-29'
  )
  AND random() < 0.65
ON CONFLICT (profile_id, shift_date) DO NOTHING;


-- ============================================================
-- ペルソナ3: フルタイム層 (S026-S030)
-- 週5日・長時間（catalog 全パターン + ◎対応）
-- 出勤確率: 75%（週5日ベース）
-- ============================================================
INSERT INTO public.shifts
  (profile_id, shift_date, start_time, end_time, is_open_start, is_open_end, note, status)
SELECT
  p.id,
  d.dt,
  tp.s,
  tp.e,
  tp.os,
  tp.oe,
  CASE WHEN random() < 0.07
    THEN '体調次第で早退させていただくかもしれません'
  END                AS note,
  'submitted'        AS status
FROM
  public.profiles p
  CROSS JOIN (
    SELECT generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day'::interval)::date AS dt
  ) d
  -- 10パターン: catalog 全域をカバー（朝番・夕番・◎を均等にバラつかせる）
  CROSS JOIN LATERAL (
    SELECT
      (ARRAY[
        '09:00'::time,  --  1: 09〜17 (8h)  朝番ロング
        '09:00'::time,  --  2: 09〜16 (7h)  朝番
        '09:00'::time,  --  3: 09〜15 (6h)  朝番ミドル
        '11:00'::time,  --  4: 11〜17 (6h)  昼番ロング
        '11:00'::time,  --  5: 11〜16 (5h)  昼番
        '14:00'::time,  --  6: 14〇  (8h)   夕番ロング
        '16:00'::time,  --  7: 16〇  (6h)   夕番
        '09:00'::time,  --  8: ◎    終日    (09:00-22:00 stored, 実効 09:00-24:00)
        '09:00'::time,  --  9: 〇start + 09〜17 (朝オープンから)
        '09:00'::time   -- 10: 09〜16 (7h)  ×repeat（朝番多め）
      ])[n] AS s,
      (ARRAY[
        '17:00'::time,  --  1
        '16:00'::time,  --  2
        '15:00'::time,  --  3
        '17:00'::time,  --  4
        '16:00'::time,  --  5
        '22:00'::time,  --  6 (is_open_end)
        '22:00'::time,  --  7 (is_open_end)
        '22:00'::time,  --  8 (◎: is_open_start + is_open_end)
        '17:00'::time,  --  9 (is_open_start)
        '16:00'::time   -- 10
      ])[n] AS e,
      (ARRAY[false,false,false,false,false,false,false, true, true,false])[n] AS os,
      (ARRAY[false,false,false,false,false, true, true, true,false,false])[n] AS oe
    FROM (SELECT ceil(random() * 10)::int AS n) r
  ) tp
WHERE
  p.role = 'staff' AND p.is_active = true
  AND p.staff_code BETWEEN 'S026' AND 'S030'
  AND random() < 0.75
ON CONFLICT (profile_id, shift_date) DO NOTHING;


-- ============================================================
-- 確認クエリ①: ペルソナ別・パターン別 件数分布
-- ============================================================
SELECT
  CASE
    WHEN p.staff_code BETWEEN 'S001' AND 'S010' THEN '①主婦・フリーター'
    WHEN p.staff_code BETWEEN 'S011' AND 'S025' THEN '②学生・ダブルワーク'
    ELSE                                              '③フルタイム'
  END                                                  AS persona,
  s.start_time,
  s.end_time,
  s.is_open_start,
  s.is_open_end,
  count(*)                                             AS 件数
FROM public.shifts s
JOIN public.profiles p ON p.id = s.profile_id
WHERE s.shift_date BETWEEN '2026-04-01' AND '2026-04-30'
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1, 2, 3;

-- ============================================================
-- 確認クエリ②: 1日あたりの時間帯別カバレッジ（人員充足サマリー検証用）
-- ============================================================
SELECT
  s.shift_date,
  to_char(s.shift_date::date, 'Dy') AS dow,
  SUM(CASE WHEN s.start_time <= '09:00' AND s.end_time > '09:00' THEN 1 ELSE 0 END) AS 朝_09,
  SUM(CASE WHEN s.start_time <= '11:00' AND s.end_time > '11:00' THEN 1 ELSE 0 END) AS ランチ_11,
  SUM(CASE WHEN s.start_time <= '14:00' AND s.end_time > '14:00' THEN 1 ELSE 0 END) AS アイドル_14,
  SUM(CASE WHEN s.start_time <= '17:00' AND s.end_time > '17:00' THEN 1 ELSE 0 END) AS ディナー_17,
  SUM(CASE WHEN s.start_time <= '21:00' AND s.end_time > '21:00' THEN 1 ELSE 0 END) AS 深夜_21
FROM public.shifts s
WHERE s.shift_date BETWEEN '2026-04-01' AND '2026-04-30'
  AND s.status = 'submitted'
GROUP BY s.shift_date
ORDER BY s.shift_date;
