-- is_open_start: 朝の開始時間フリー（何時から入れる）を示すフラグ
-- true のとき、UI では「〇」と表示し、start_time は 09:00 で統一する。
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS is_open_start boolean NOT NULL DEFAULT false;
