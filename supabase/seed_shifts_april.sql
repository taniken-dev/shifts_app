-- ============================================================
-- テスト用シフト希望データ — 2026年4月（1日〜30日）
-- ============================================================
-- 修正: ORDER BY random() LIMIT 1 はPostgreSQLの最適化で
--       外部ループごとに再評価されない場合がある。
--       random() を1回だけ呼んで整数インデックス n を生成し、
--       並列配列から start_time / end_time を同時に取り出す方式に変更。
-- ============================================================

INSERT INTO public.shifts
  (profile_id, shift_date, start_time, end_time, note, status)

SELECT
  p.id          AS profile_id,
  d.dt          AS shift_date,
  tp.start_time,
  tp.end_time,

  -- 約15%の確率で備考を付与
  CASE
    WHEN random() < 0.15 THEN
      (ARRAY[
        'テスト期間中のため午後のみ希望です',
        '授業の都合でこの時間しか入れません',
        '少し遅れる可能性があります',
        '体調次第で早退させていただくかもしれません',
        'この日は早めに上がれると助かります',
        '他のバイトと被るため終了時間は厳守でお願いします'
      ])[ceil(random() * 6)::int]
    ELSE NULL
  END            AS note,

  'submitted'    AS status

FROM
  public.profiles p

  CROSS JOIN (
    SELECT generate_series(
      '2026-04-01'::date,
      '2026-04-30'::date,
      '1 day'::interval
    )::date AS dt
  ) AS d

  -- ポイント: random() を1回だけ呼び整数 n を確定させてから
  --           同じ n で start/end を並列配列から取り出す。
  --           これにより start と end のペアがずれず、
  --           かつ外部行ごとに確実に再評価される。
  CROSS JOIN LATERAL (
    SELECT
      s_arr[n] AS start_time,
      e_arr[n] AS end_time
    FROM (
      SELECT
        ceil(random() * 13)::int AS n,
        -- 開始時間（13パターン）
        ARRAY[
          '09:00'::time,  -- 1: ランチ短め
          '09:00'::time,  -- 2
          '10:00'::time,  -- 3
          '10:00'::time,  -- 4
          '11:00'::time,  -- 5
          '11:00'::time,  -- 6
          '09:00'::time,  -- 7: 通し・長め
          '09:00'::time,  -- 8
          '10:00'::time,  -- 9
          '10:00'::time,  -- 10
          '16:00'::time,  -- 11: ディナー帯
          '17:00'::time,  -- 12
          '18:00'::time   -- 13
        ] AS s_arr,
        -- 終了時間（同インデックスで対応）
        ARRAY[
          '13:00'::time,  -- 1
          '14:00'::time,  -- 2
          '14:00'::time,  -- 3
          '15:00'::time,  -- 4
          '15:00'::time,  -- 5
          '16:00'::time,  -- 6
          '17:00'::time,  -- 7
          '21:00'::time,  -- 8
          '18:00'::time,  -- 9
          '21:00'::time,  -- 10
          '21:00'::time,  -- 11
          '22:00'::time,  -- 12
          '22:00'::time   -- 13
        ] AS e_arr
    ) r
  ) AS tp

WHERE
  p.role      = 'staff'
  AND p.is_active  = true
  AND p.staff_code LIKE 'S0%'
  AND random() < 0.70

ON CONFLICT (profile_id, shift_date) DO NOTHING;

-- ============================================================
-- 結果確認: 時間パターンの分布（均一にばらけているか確認）
-- ============================================================
SELECT
  start_time,
  end_time,
  count(*) AS 件数
FROM public.shifts
WHERE shift_date BETWEEN '2026-04-01' AND '2026-04-30'
GROUP BY start_time, end_time
ORDER BY start_time, end_time;
