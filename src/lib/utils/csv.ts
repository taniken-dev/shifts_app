import type { ShiftWithProfile } from '@/types/database'

/**
 * シフトデータを Shift-JIS 互換の CSV に変換する。
 * Excel でそのまま開けるよう BOM を付与する。
 */
export function shiftsToCSV(shifts: ShiftWithProfile[]): string {
  const headers = ['日付', 'スタッフコード', '氏名', '開始時間', '終了時間', '勤務時間(分)', '備考', 'ステータス']

  const STATUS_LABELS: Record<string, string> = {
    submitted: '提出済',
    approved:  '承認済',
    rejected:  '却下',
  }

  const rows = shifts.map((s) => {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    const durationMin = (eh * 60 + em) - (sh * 60 + sm)

    return [
      s.shift_date,
      s.profiles.staff_code,
      s.profiles.full_name,
      s.start_time.slice(0, 5),
      s.end_time.slice(0, 5),
      String(durationMin),
      s.note ?? '',
      STATUS_LABELS[s.status] ?? s.status,
    ]
  })

  const csvLines = [headers, ...rows].map((row) =>
    row.map(escapeCSVField).join(',')
  )
  const csv = '\uFEFF' + csvLines.join('\r\n') // BOM + CRLF

  return csv
}

/** CSV フィールドのエスケープ（カンマ・改行・ダブルクォートを含む場合はクォートで囲む） */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
