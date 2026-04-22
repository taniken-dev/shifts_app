export type SegmentKey = 'morning' | 'lunch' | 'idle' | 'dinner' | 'midnight'

export interface TimeSegment {
  key:   SegmentKey
  label: string
  start: string  // "HH:MM"
  end:   string  // "HH:MM" (use "24:00" for midnight)
}

export const TIME_SEGMENTS: readonly TimeSegment[] = [
  { key: 'morning',  label: '朝',      start: '09:00', end: '11:00' },
  { key: 'lunch',    label: 'ランチ',   start: '11:00', end: '14:00' },
  { key: 'idle',     label: 'アイドル', start: '14:00', end: '17:00' },
  { key: 'dinner',   label: 'ディナー', start: '17:00', end: '21:00' },
  { key: 'midnight', label: '深夜',     start: '21:00', end: '24:00' },
]

const SEGMENT_TARGETS: Record<SegmentKey, { weekday: number; holiday: number }> = {
  morning:  { weekday: 3, holiday: 4 },
  lunch:    { weekday: 5, holiday: 7 },
  idle:     { weekday: 2, holiday: 4 },
  dinner:   { weekday: 4, holiday: 6 },
  midnight: { weekday: 2, holiday: 3 },
}

// ─── Japanese holiday calculation ─────────────────────────────────────────────

function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  let count = 0
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month - 1, d)
    if (date.getMonth() !== month - 1) break
    if (date.getDay() === weekday) {
      count++
      if (count === n) return d
    }
  }
  return 1
}

// Approximate spring/autumn equinox day for 1980–2099
function vernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeHolidays(year: number): Set<string> {
  const h = new Set<string>()
  const add = (m: number, d: number) =>
    h.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  add(1,  1)                                     // 元日
  add(1,  nthWeekday(year, 1,  1, 2))            // 成人の日 (1月第2月曜)
  add(2,  11)                                    // 建国記念の日
  if (year >= 2020) add(2, 23)                   // 天皇誕生日
  add(3,  vernalEquinox(year))                   // 春分の日
  add(4,  29)                                    // 昭和の日
  add(5,  3)                                     // 憲法記念日
  add(5,  4)                                     // みどりの日
  add(5,  5)                                     // こどもの日
  add(7,  nthWeekday(year, 7,  1, 3))            // 海の日 (7月第3月曜)
  if (year >= 2016) add(8, 11)                   // 山の日
  add(9,  nthWeekday(year, 9,  1, 3))            // 敬老の日 (9月第3月曜)
  add(9,  autumnalEquinox(year))                 // 秋分の日
  add(10, nthWeekday(year, 10, 1, 2))            // スポーツの日 (10月第2月曜)
  add(11, 3)                                     // 文化の日
  add(11, 23)                                    // 勤労感謝の日

  // 振替休日: 祝日が日曜 → 翌月曜（連続する場合は順送り）
  for (const ds of [...h].sort()) {
    const d = new Date(ds + 'T00:00:00')
    if (d.getDay() === 0) {
      let sub = new Date(d)
      sub.setDate(sub.getDate() + 1)
      while (h.has(dateStr(sub))) sub.setDate(sub.getDate() + 1)
      h.add(dateStr(sub))
    }
  }

  // 国民の休日: 2つの祝日に挟まれた平日
  const sorted = [...h].sort()
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = new Date(sorted[i]     + 'T00:00:00')
    const b = new Date(sorted[i + 1] + 'T00:00:00')
    if ((b.getTime() - a.getTime()) / 86400000 === 2) {
      const between = new Date(a)
      between.setDate(between.getDate() + 1)
      const dow = between.getDay()
      if (dow !== 0 && dow !== 6) h.add(dateStr(between))
    }
  }

  return h
}

const _cache = new Map<number, Set<string>>()

function getHolidaysForYear(year: number): Set<string> {
  if (!_cache.has(year)) _cache.set(year, computeHolidays(year))
  return _cache.get(year)!
}

export function isHolidayOrWeekend(ds: string): boolean {
  const d = new Date(ds + 'T00:00:00')
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return true
  return getHolidaysForYear(d.getFullYear()).has(ds)
}

// ─── Staffing logic ───────────────────────────────────────────────────────────

export function getSegmentTarget(key: SegmentKey, dateStr: string): number {
  return SEGMENT_TARGETS[key][isHolidayOrWeekend(dateStr) ? 'holiday' : 'weekday']
}

export type SufficiencyStatus = 'shortage' | 'ok' | 'excess'

export function getSufficiencyStatus(count: number, target: number): SufficiencyStatus {
  if (count < target) return 'shortage'
  if (count === target) return 'ok'
  return 'excess'
}

export interface ShiftLike {
  shift_date: string
  start_time: string
  end_time:   string
  status:     string
}

export function countStaffForSegment(
  shifts: ShiftLike[],
  date: string,
  segment: TimeSegment,
  includeSubmitted: boolean,
): number {
  return shifts.filter(sh => {
    if (sh.shift_date !== date) return false
    if (sh.status === 'rejected') return false
    if (!includeSubmitted && sh.status !== 'approved') return false
    return sh.start_time < segment.end && sh.end_time > segment.start
  }).length
}
