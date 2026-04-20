-- is_open_end: メンテ（閉店作業）まで対応可能なシフトを示すフラグ
-- true のとき、UI では「〇」と表示し、end_time は 22:00 で統一する。
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS is_open_end boolean NOT NULL DEFAULT false;
