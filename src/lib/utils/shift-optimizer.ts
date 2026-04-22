import { TIME_SEGMENTS, TimeSegment, SegmentKey, getSegmentTarget } from './shift-calculator'

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface OptimizableShift {
  id:            string
  profile_id:    string
  shift_date:    string
  start_time:    string
  end_time:      string
  status:        string
  /** true のとき end_time は '22:00' で保存されているが、実効終了は閉店（24:00）まで */
  is_open_end?:  boolean
}

export type OptRec = 'approve' | 'reject'

export interface OptimizationResult {
  shiftId:          string
  staffId:          string
  recommendation:   OptRec
  reason:           string
  score:            number
  /** AIが提案する開始時間（枠トリミングが発生した場合のみ設定） */
  suggestedStart:   string
  /** AIが提案する終了時間（枠トリミングが発生した場合のみ設定） */
  suggestedEnd:     string
  /** 元の希望枠から時間が調整された場合 true */
  trimmed:          boolean
  /** 定員に達していた（却下理由となった）セグメントのキー一覧 */
  rejectedSegments: SegmentKey[]
}

// ── 時間ユーティリティ ─────────────────────────────────────────────────────────

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function toTime(m: number): string {
  const h   = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** 2つの HH:MM のうち遅い方を返す */
const laterTime  = (a: string, b: string) => toMin(a) >= toMin(b) ? a : b
/** 2つの HH:MM のうち早い方を返す */
const earlierTime = (a: string, b: string) => toMin(a) <= toMin(b) ? a : b

/** シフト時間を時間単位で返す */
export function calcShiftHours(startTime: string, endTime: string): number {
  return Math.max(0, (toMin(endTime) - toMin(startTime)) / 60)
}

// ── シフトカタログ ─────────────────────────────────────────────────────────────

/**
 * 店舗で実際に使用される標準シフトパターン一覧。
 * 実シフト表の手書きパターンから抽出:
 *   朝〜ランチ帯: 09〜14, 09〜15, 09〜16, 09〜17, 10〜15, 10〜16, 11〜15, 11〜16, 11〜17
 *   夕方帯 (〇end): 14〇, 16〇, 17〇 (is_open_end=true → DB stores 22:00)
 *
 * AI 提案は必ずこのカタログから選択するため「12:00〜」等の中途半端な時間は出力しない。
 */
const SHIFT_CATALOG: ReadonlyArray<{ start: string; end: string }> = [
  // ─ 朝〜ランチ帯（固定終了）─
  { start: '09:00', end: '14:00' },  // 5h  09〜14
  { start: '09:00', end: '15:00' },  // 6h  09〜15
  { start: '09:00', end: '16:00' },  // 7h  09〜16
  { start: '09:00', end: '17:00' },  // 8h  09〜17（フルタイム朝番）
  { start: '10:00', end: '15:00' },  // 5h  10〜15
  { start: '10:00', end: '16:00' },  // 6h  10〜16
  { start: '11:00', end: '15:00' },  // 4h  11〜15
  { start: '11:00', end: '16:00' },  // 5h  11〜16
  { start: '11:00', end: '17:00' },  // 6h  11〜17
  // ─ 夕方〜閉店（〇end: is_open_end=true で DB に 22:00 格納）─
  { start: '14:00', end: '22:00' },  // 8h  14〇
  { start: '16:00', end: '22:00' },  // 6h  16〇
  { start: '17:00', end: '22:00' },  // 5h  17〇（最頻パターン）
]

/** ロング希望と判定する閾値（時間）*/
const TRIM_THRESHOLD_HOURS = 6

/** セグメントの優先度（低いインデックス = 高優先）*/
const SEGMENT_PRIORITY: SegmentKey[] = ['lunch', 'dinner', 'morning', 'idle', 'midnight']

/**
 * 希望枠 [availStart, availEnd] をカタログから最適パターンに切り出す。
 *
 * - 希望時間が TRIM_THRESHOLD_HOURS 以下なら変更しない
 * - SHIFT_CATALOG から「希望枠内に収まる」かつ「必要セグメントを最もカバーする」パターンを選択
 * - カタログに適合するパターンがなければ変更しない（中途半端な時間を出力しない）
 */
export function computeAssignedTime(
  availStart: string,
  availEnd:   string,
  neededSegs: TimeSegment[],
  capacityMap: Map<SegmentKey, number>,
): { assignedStart: string; assignedEnd: string; trimmed: boolean } {
  const noTrim = { assignedStart: availStart, assignedEnd: availEnd, trimmed: false }

  if (neededSegs.length === 0) return noTrim

  const availDuration = calcShiftHours(availStart, availEnd)
  if (availDuration <= TRIM_THRESHOLD_HOURS) return noTrim

  // カタログから「希望枠に収まる」パターンを抽出
  const availStartMin = toMin(availStart)
  const availEndMin   = toMin(availEnd)
  const candidates = SHIFT_CATALOG.filter(c =>
    toMin(c.start) >= availStartMin && toMin(c.end) <= availEndMin
  )

  if (candidates.length === 0) return noTrim

  // 各候補のスコア: 必要セグメントのカバー数 × (残余キャパ × 10 + 優先度ボーナス)
  let best: { start: string; end: string } | null = null
  let bestScore = 0

  for (const c of candidates) {
    let score = 0
    for (const seg of neededSegs) {
      if (c.start < seg.end && c.end > seg.start) {
        const priorityBonus = SEGMENT_PRIORITY.length - SEGMENT_PRIORITY.indexOf(seg.key)
        score += (capacityMap.get(seg.key) ?? 0) * 10 + priorityBonus
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  // どのパターンも必要セグメントをカバーしない → トリミング不要
  if (!best || bestScore === 0) return noTrim

  const isTrimmed = best.start !== availStart || best.end !== availEnd
  if (!isTrimmed) return noTrim

  return { assignedStart: best.start, assignedEnd: best.end, trimmed: true }
}

// ── スコアリング ───────────────────────────────────────────────────────────────

function scoreShift(
  profileId: string,
  staffLevels: Map<string, number>,
  monthlyHoursMap: Map<string, number>,
  maxHours: number,
): { score: number; level: number; hours: number } {
  const level = staffLevels.get(profileId) ?? 1
  const hours = monthlyHoursMap.get(profileId) ?? 0

  const veteranBonus  = level >= 4 ? 10000 : 0
  const fairnessScore = maxHours > 0 ? Math.round(1000 * (1 - hours / maxHours)) : 500
  const levelScore    = level * 100

  return { score: veteranBonus + fairnessScore + levelScore, level, hours }
}

function buildApproveReason(
  level: number,
  hours: number,
  maxHours: number,
  assignedSegLabels: string[],
  trimmed: boolean,
  origStart: string,
  origEnd:   string,
  assignedStart: string,
  assignedEnd:   string,
): string {
  const parts: string[] = []
  parts.push(`${assignedSegLabels.join('・')}の人員不足を補填`)

  if (level >= 4) {
    parts.push(`ベテランスタッフ（Lv.${level}）のため優先配置`)
  } else if (level >= 3) {
    parts.push(`中堅スタッフ（Lv.${level}）`)
  }
  if (maxHours > 4 && hours < maxHours * 0.5) {
    parts.push(`今月の勤務が少ない（${Math.round(hours)}h）`)
  }
  if (trimmed) {
    parts.push(`希望枠 ${origStart}〜${origEnd} をピーク ${assignedStart}〜${assignedEnd} にトリミング`)
  }

  return parts.join('・')
}

function buildRejectReason(level: number, atCapacitySegs: TimeSegment[]): string {
  const base = atCapacitySegs.length > 0
    ? `${atCapacitySegs.map(s => s.label).join('・')}が定員に達しているため調整依頼`
    : '全対象時間帯が定員に達しているため調整依頼'
  if (level >= 4) return `${base}（ベテランLv.${level}だが超過）`
  return base
}

// ── メイン最適化関数 ──────────────────────────────────────────────────────────

/**
 * 1日分のシフトを最適化する。
 *
 * 各提出済みシフトは「勤務可能枠（Availability）」として扱い、
 * 必要なピーク時間帯に合わせてトリミングした上で割り当てる。
 * グリーディ法: スコア降順に割り当て、少なくとも1セグメントを補填できれば承認。
 */
export function optimizeDate(
  date: string,
  shiftsForDate: OptimizableShift[],
  staffLevels: Map<string, number>,
  monthlyHoursMap: Map<string, number>,
): OptimizationResult[] {
  const approved  = shiftsForDate.filter(s => s.status === 'approved')
  const submitted = shiftsForDate.filter(s => s.status === 'submitted')

  if (submitted.length === 0) return []

  const allHours = [...monthlyHoursMap.values()]
  const maxHours = allHours.length > 0 ? Math.max(...allHours, 1) : 1

  const scored = submitted
    .map(shift => ({ shift, ...scoreShift(shift.profile_id, staffLevels, monthlyHoursMap, maxHours) }))
    .sort((a, b) => b.score - a.score)

  // 承認済みシフトで各セグメントの残余キャパを初期化
  const capacity = new Map<SegmentKey, number>()
  for (const seg of TIME_SEGMENTS) {
    const filled = approved.filter(s => s.start_time < seg.end && s.end_time > seg.start).length
    capacity.set(seg.key, Math.max(0, getSegmentTarget(seg.key, date) - filled))
  }

  const results: OptimizationResult[] = []

  for (const { shift, score, level, hours } of scored) {
    // is_open_end=true のとき実効終了を 24:00 に拡張（深夜セグメント 21:00-24:00 をフルカバー）
    const effectiveEnd    = shift.is_open_end ? '24:00' : shift.end_time
    // UI 表示用の元時間表現（◎/〇 を含む）
    const origEndDisplay  = shift.is_open_end ? '〇'    : shift.end_time

    // 1. この希望枠で補填できるセグメント（希望枠全体との重なり、かつ残余あり）
    const neededByAvail = TIME_SEGMENTS.filter(seg => {
      if (shift.start_time >= seg.end || effectiveEnd <= seg.start) return false
      return (capacity.get(seg.key) ?? 0) > 0
    })

    if (neededByAvail.length === 0) {
      const atCapacitySegs = TIME_SEGMENTS.filter(seg => {
        if (shift.start_time >= seg.end || effectiveEnd <= seg.start) return false
        return (capacity.get(seg.key) ?? 0) === 0
      })
      results.push({
        shiftId:          shift.id,
        staffId:          shift.profile_id,
        recommendation:   'reject',
        reason:           buildRejectReason(level, atCapacitySegs),
        score,
        suggestedStart:   shift.start_time,
        suggestedEnd:     shift.end_time,
        trimmed:          false,
        rejectedSegments: atCapacitySegs.map(s => s.key),
      })
      continue
    }

    // 2. トリミング: ロング希望枠をピーク時間に合わせて切り出す
    const { assignedStart, assignedEnd, trimmed } = computeAssignedTime(
      shift.start_time,
      effectiveEnd,
      neededByAvail,
      capacity,
    )

    // 3. 割り当て後の時間帯でカバーできるセグメントを確定
    const coveredSegs = TIME_SEGMENTS.filter(seg => {
      if (assignedStart >= seg.end || assignedEnd <= seg.start) return false
      return (capacity.get(seg.key) ?? 0) > 0
    })

    // トリミング後も補填対象セグメントが存在しない場合は元枠で再計算
    const finalSegs    = coveredSegs.length > 0 ? coveredSegs    : neededByAvail
    const finalStart   = coveredSegs.length > 0 ? assignedStart  : shift.start_time
    const finalEnd     = coveredSegs.length > 0 ? assignedEnd    : effectiveEnd
    const finalTrimmed = coveredSegs.length > 0 ? trimmed        : false

    results.push({
      shiftId:          shift.id,
      staffId:          shift.profile_id,
      recommendation:   'approve',
      reason: buildApproveReason(
        level, hours, maxHours,
        finalSegs.map(s => s.label),
        finalTrimmed,
        shift.start_time, origEndDisplay,
        finalStart, finalEnd,
      ),
      score,
      suggestedStart:   finalStart,
      suggestedEnd:     finalEnd,
      trimmed:          finalTrimmed,
      rejectedSegments: [],
    })

    // 確定したセグメントのキャパを減算
    for (const seg of finalSegs) {
      capacity.set(seg.key, (capacity.get(seg.key) ?? 0) - 1)
    }
  }

  return results
}

/** 枠トリミングロジックを外部テスト用にも公開 */
export { toMin, toTime, laterTime, earlierTime }
