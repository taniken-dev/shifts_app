'use client'

import { useState, useMemo, useCallback, useEffect, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, AlertCircle, CalendarRange, Sparkles,
  X, ChevronLeft, ChevronRight, CheckSquare, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { calcDeadline, formatDeadline, BYPASS_DEADLINE } from '@/lib/utils/deadline'
import DayShiftCard, { type DayEntry } from './DayShiftCard'
import { Toast } from '@/components/ui/Toast'

type Period = 'first' | 'second'

type ExistingShift = {
  start_time:    string
  end_time:      string
  status:        'submitted' | 'approved' | 'rejected'
  admin_adjusted: boolean
  is_open_end:   boolean
  is_open_start: boolean
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

const BULK_PRESETS = [
  { label: '11〜17', start: '11:00', end: '17:00', isOpenStart: false, isOpenEnd: false },
  { label: '11〜15', start: '11:00', end: '15:00', isOpenStart: false, isOpenEnd: false },
  { label: '〇〜17', start: '09:00', end: '17:00', isOpenStart: true,  isOpenEnd: false },
  { label: '〇〜15', start: '09:00', end: '15:00', isOpenStart: true,  isOpenEnd: false },
  { label: '17〜〇', start: '17:00', end: '22:00', isOpenStart: false, isOpenEnd: true  },
  { label: '◎',     start: '09:00', end: '22:00', isOpenStart: true,  isOpenEnd: true  },
]

function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date()
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    return { value: `${y}-${String(m).padStart(2, '0')}`, label: `${y}年${m}月` }
  })
}

function getNextSubmissionPeriod(now: Date): { month: string; period: Period } {
  let checkYear = now.getFullYear()
  let checkMonth = now.getMonth() + 1
  let checkPeriod: Period = now.getDate() <= 15 ? 'first' : 'second'

  for (let i = 0; i < 8; i++) {
    const monthStr = `${checkYear}-${String(checkMonth).padStart(2, '0')}`
    if (calcDeadline(monthStr, checkPeriod) > now) {
      return { month: monthStr, period: checkPeriod }
    }
    if (checkPeriod === 'first') {
      checkPeriod = 'second'
    } else {
      checkPeriod = 'first'
      if (++checkMonth > 12) { checkMonth = 1; checkYear++ }
    }
  }
  const m = now.getMonth() + 2
  const overflow = m > 12
  return { month: `${overflow ? now.getFullYear() + 1 : now.getFullYear()}-${String(overflow ? m - 12 : m).padStart(2, '0')}`, period: 'first' }
}

function lastDayOf(year: number, month: number) { return new Date(year, month, 0).getDate() }

function periodRange(period: Period, year: number, month: number): [number, number] {
  return period === 'first' ? [1, 15] : [16, lastDayOf(year, month)]
}


function buildEntries(monthStr: string, period: Period): DayEntry[] {
  const [y, m] = monthStr.split('-').map(Number)
  const [start, end] = periodRange(period, y, m)
  return Array.from({ length: end - start + 1 }, (_, i) => ({
    date:      `${y}-${String(m).padStart(2, '0')}-${String(start + i).padStart(2, '0')}`,
    isOff:       true,
    startTime:   '11:00',
    endTime:     '17:00',
    isOpenStart: false,
    isOpenEnd:   false,
  }))
}

/** 時刻文字列を30分単位に丸める (例: "11:14" → "11:00", "11:17" → "11:30") */
function roundTo30Min(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const rounded = Math.round(m / 30) * 30
  if (rounded >= 60) return `${String(h + 1).padStart(2, '0')}:00`
  return `${String(h).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`
}

// ── カレンダーセル ────────────────────────────────────────────────────────────

interface CalendarCellProps {
  approvedTime?: string  // "HH:MM〜HH:MM"（承認済み時に表示）
  entry:          DayEntry
  hasError:       boolean
  isSelected:     boolean
  isBulkMode:     boolean
  isBulkSelected: boolean
  serverStatus?:  'submitted' | 'approved' | null
  adminAdjusted?: boolean
  onClick:        () => void
}

function CalendarCell({ entry, hasError, isSelected, isBulkMode, isBulkSelected, serverStatus, adminAdjusted, approvedTime, onClick }: CalendarCellProps) {
  const date    = new Date(entry.date + 'T00:00:00')
  const dow     = date.getDay()
  const dayNum  = date.getDate()
  const isSun   = dow === 0
  const isSat   = dow === 6
  const isUnset = entry.isOff === null

  const numColor = isUnset
    ? (isSun ? '#fca5a5' : isSat ? '#93c5fd' : '#9ca3af')
    : entry.isOff ? '#d1d5db'
    : isSun ? '#d6231e' : isSat ? '#3b82f6' : '#111827'

  const isApproved = serverStatus === 'approved'

  const cellBg = isBulkSelected
    ? '#eff6ff'
    : isApproved ? '#ecfdf5'
    : isSelected ? (entry.isOff === false ? '#f0fdf4' : '#f9fafb')
    : hasError ? '#fff1f1'
    : isUnset ? '#fafafa'
    : entry.isOff ? '#f9fafb'
    : '#ffffff'

  const cellBorder = isBulkSelected
    ? '2px solid #3b82f6'
    : isApproved ? '1.5px solid #6ee7b7'
    : isSelected ? '1.5px solid #374151'
    : hasError ? '1.5px solid #fca5a5'
    : isUnset ? '1.5px dashed #e5e7eb'
    : entry.isOff ? '1.5px solid #f1f5f9'
    : '1.5px solid #e9f5ee'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '3px',
        padding: '7px 3px', borderRadius: '12px',
        backgroundColor: cellBg, border: cellBorder,
        cursor: 'pointer', transition: 'all 120ms ease',
        minHeight: '64px', width: '100%', position: 'relative',
      }}
    >
      {isBulkMode && (
        <div style={{
          position: 'absolute', top: '3px', left: '3px',
          width: '14px', height: '14px', borderRadius: '50%',
          backgroundColor: isBulkSelected ? '#3b82f6' : 'transparent',
          border: isBulkSelected ? '2px solid #3b82f6' : '2px solid #d1d5db',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isBulkSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff' }} />}
        </div>
      )}

      <span style={{
        fontSize: '17px', fontWeight: isUnset ? 600 : 800, lineHeight: 1,
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: numColor,
      }}>
        {dayNum}
      </span>

      {isUnset ? (
        <span style={{ fontSize: '8px', fontWeight: 500, color: '#d1d5db' }}>未選択</span>
      ) : entry.isOff ? (
        <span style={{ fontSize: '8px', fontWeight: 600, color: '#d1d5db' }}>休み</span>
      ) : hasError ? (
        <span style={{ fontSize: '8px', fontWeight: 700, color: '#d6231e' }}>⚠</span>
      ) : (
        <span style={{ fontSize: '8px', fontWeight: 600, color: '#006633', lineHeight: 1.3, textAlign: 'center' }}>
          {entry.isOpenStart && entry.isOpenEnd
            ? '◎'
            : `${entry.isOpenStart ? '〇' : entry.startTime.replace(':00','')}〜${entry.isOpenEnd ? '〇' : entry.endTime.replace(':00','')}`}
        </span>
      )}

      {!isUnset && !isBulkMode && (
        <div style={{
          position: 'absolute', top: '4px', right: '4px',
          width: '5px', height: '5px', borderRadius: '50%',
          backgroundColor: hasError ? '#d6231e' : entry.isOff ? '#e5e7eb' : '#006633',
        }} />
      )}

      {/* サーバー側ステータスバッジ */}
      {serverStatus === 'approved' && approvedTime && (
        <span style={{
          fontSize: '9px', fontWeight: 800, color: '#065f46',
          lineHeight: 1.3, textAlign: 'center', letterSpacing: '-0.01em',
        }}>
          {approvedTime}
        </span>
      )}
      {serverStatus === 'approved' && (
        <span style={{
          fontSize: '7px', fontWeight: 700, color: '#059669',
          backgroundColor: '#d1fae5', borderRadius: '3px', padding: '1px 5px',
          whiteSpace: 'nowrap',
        }}>
          {adminAdjusted ? '✓ 調整済' : '✓ 承認済'}
        </span>
      )}
      {serverStatus === 'submitted' && (
        <span style={{
          fontSize: '7px', fontWeight: 600, color: '#3b82f6',
          backgroundColor: '#dbeafe', borderRadius: '3px', padding: '1px 4px',
          whiteSpace: 'nowrap',
        }}>
          提出済
        </span>
      )}
    </button>
  )
}

// ── 承認済みバナー ────────────────────────────────────────────────────────────

function ApprovedBanner({ count, adminAdjustedCount }: { count: number; adminAdjustedCount: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '14px 16px', borderRadius: '14px',
      backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0',
    }}>
      <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0, marginTop: '1px' }} aria-hidden />
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', margin: 0 }}>
          {count}日分のシフトが承認されました
        </p>
        {adminAdjustedCount > 0 && (
          <p style={{ fontSize: '11px', color: '#0369a1', margin: '4px 0 0', fontWeight: 600 }}>
            ✎ {adminAdjustedCount}日分は店長により時間が調整されています
          </p>
        )}
      </div>
    </div>
  )
}

// ── 提出済みバナー ────────────────────────────────────────────────────────────

function SubmittedBanner({ count, onReEdit }: { count: number; onReEdit: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: '14px',
      backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CheckCircle2 size={16} style={{ color: '#006633', flexShrink: 0 }} aria-hidden />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', margin: 0 }}>
            {count}日分のシフトが提出済みです
          </p>
          <p style={{ fontSize: '11px', color: '#059669', margin: '2px 0 0' }}>
            承認前であれば内容を変更できます
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReEdit}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '10px 16px', borderRadius: '9999px',
          backgroundColor: '#006633', color: '#ffffff',
          fontSize: '13px', fontWeight: 700,
          border: 'none', cursor: 'pointer', flexShrink: 0,
          minHeight: '44px',
        }}
      >
        <Pencil size={13} aria-hidden />再編集する
      </button>
    </div>
  )
}

// ── 編集モードバナー ──────────────────────────────────────────────────────────

function EditModeBanner({ periodLabel, onCancel }: { periodLabel: string; onCancel: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: '14px',
      backgroundColor: '#fffbeb', border: '1.5px solid #fcd34d', gap: '12px',
    }}>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', margin: 0 }}>
          ✎ 編集モード — {periodLabel}
        </p>
        <p style={{ fontSize: '11px', color: '#b45309', margin: '2px 0 0' }}>
          変更して「シフトを更新する」を押してください
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '8px 14px', borderRadius: '9999px',
          backgroundColor: 'transparent', color: '#92400e',
          fontSize: '12px', fontWeight: 600,
          border: '1.5px solid #fcd34d', cursor: 'pointer', flexShrink: 0,
          minHeight: '44px',
        }}
      >
        <X size={13} aria-hidden />取消
      </button>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function ShiftPeriodForm() {
  const router       = useRouter()
  const monthOptions = useMemo(buildMonthOptions, [])
  const { month: defaultMonth, period: defaultPeriod } = useMemo(() => getNextSubmissionPeriod(new Date()), [])

  const [month,            setMonth]            = useState<string>(defaultMonth)
  const [period,           setPeriod]           = useState<Period>(defaultPeriod)

  const deadline       = useMemo(() => calcDeadline(month, period), [month, period])
  const isPastDeadline = useMemo(() => !BYPASS_DEADLINE && new Date() > deadline, [deadline])
  const [entries,          setEntries]          = useState<DayEntry[]>(() => buildEntries(defaultMonth, defaultPeriod))
  const [isPending,        startTransition]     = useTransition()
  const [success,          setSuccess]          = useState(false)
  const [submitError,      setSubmitError]      = useState<string | null>(null)
  const [existingShifts,   setExistingShifts]   = useState<Map<string, ExistingShift>>(new Map())
  const [isEditMode,       setIsEditMode]       = useState(false)
  const [toastMsg,         setToastMsg]         = useState<string | null>(null)
  const [fetchingExisting, setFetchingExisting] = useState(false)
  const [touchedCard,      setTouchedCard]      = useState<'period' | 'calendar' | null>(null)

  const [optimisticShifts, setOptimisticShifts] = useOptimistic(
    existingShifts,
    (_: Map<string, ExistingShift>, next: Map<string, ExistingShift>) => next,
  )

  // 単日選択
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  // 一括選択
  const [bulkMode,    setBulkMode]    = useState(false)
  const [bulkSet,     setBulkSet]     = useState<Set<number>>(new Set())

  // ── 既存提出済みシフト取得 ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function fetchExisting() {
      setFetchingExisting(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setFetchingExisting(false); return }

      const [y, m] = month.split('-').map(Number)
      const [s, e] = periodRange(period, y, m)
      const pad = (n: number) => String(n).padStart(2, '0')

      const { data } = await supabase
        .from('shifts')
        .select('shift_date, start_time, end_time, status, admin_adjusted, is_open_end, is_open_start')
        .eq('profile_id', user.id)
        .gte('shift_date', `${y}-${pad(m)}-${pad(s)}`)
        .lte('shift_date', `${y}-${pad(m)}-${pad(e)}`)
        .in('status', ['submitted', 'approved'])

      if (!cancelled) {
        setExistingShifts(
          data
            ? new Map(data.map(r => [r.shift_date, {
                start_time:     r.start_time,
                end_time:       r.end_time,
                status:         r.status as ExistingShift['status'],
                admin_adjusted: r.admin_adjusted ?? false,
                is_open_end:    r.is_open_end   ?? false,
                is_open_start:  r.is_open_start ?? false,
              }]))
            : new Map()
        )
        setFetchingExisting(false)
      }
    }

    fetchExisting()
    return () => { cancelled = true }
  }, [month, period])

  // ── 期間変更ハンドラ ────────────────────────────────────────────────────────

  const changeMonth = (v: string) => {
    setMonth(v); setEntries(buildEntries(v, period))
    setSuccess(false); setSubmitError(null); setSelectedIdx(null); clearBulk()
    setIsEditMode(false)
  }
  const changePeriod = (p: Period) => {
    setPeriod(p); setEntries(buildEntries(month, p))
    setSuccess(false); setSubmitError(null); setSelectedIdx(null); clearBulk()
    setIsEditMode(false)
  }
  const updateEntry = useCallback((i: number, updated: DayEntry) => {
    setEntries(prev => prev.map((e, idx) => (idx === i ? updated : e)))
  }, [])

  const [y, m]      = month.split('-').map(Number)
  const last        = lastDayOf(y, m)
  const [s, e]      = periodRange(period, y, m)
  const periodLabel = `${m}月${s}日〜${e}日`
  const workingList = entries.filter(en => en.isOff === false)
  const hasErrors   = entries.some(en => en.isOff === false && !en.isOpenEnd && !en.isOpenStart && en.startTime >= en.endTime)
  // 編集モードでは出勤0日でも更新可（全削除の意図）
  const canSubmit   = !isPending && (isEditMode
    ? !hasErrors
    : !success && !hasErrors && workingList.length > 0)
  const canPrev     = selectedIdx !== null && selectedIdx > 0
  const canNext     = selectedIdx !== null && selectedIdx < entries.length - 1

  // 既存シフトのステータス集計（楽観的状態を参照）
  const submittedCount    = [...optimisticShifts.values()].filter(v => v.status === 'submitted').length
  const approvedCount     = [...optimisticShifts.values()].filter(v => v.status === 'approved').length
  const adminAdjustedDates = new Set(
    [...optimisticShifts.entries()]
      .filter(([, v]) => v.admin_adjusted)
      .map(([k]) => k),
  )

  // ── 一括操作 ─────────────────────────────────────────────────────────────

  function clearBulk() { setBulkMode(false); setBulkSet(new Set()) }

  function toggleBulkMode() {
    if (bulkMode) { clearBulk() } else {
      setBulkMode(true); setSelectedIdx(null); setBulkSet(new Set())
    }
  }

  function toggleBulkItem(idx: number) {
    setBulkSet(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function bulkSelectAll() { setBulkSet(new Set(entries.map((_, i) => i))) }
  function bulkClearAll()  { setBulkSet(new Set()) }

  function applyBulkPreset(startTime: string, endTime: string, isOpenStart: boolean, isOpenEnd: boolean) {
    if (bulkSet.size === 0) return
    setEntries(prev => prev.map((en, i) =>
      bulkSet.has(i) ? { ...en, isOff: false, startTime, endTime, isOpenStart, isOpenEnd } : en
    ))
    clearBulk()
  }

  function applyBulkOff() {
    if (bulkSet.size === 0) return
    setEntries(prev => prev.map((en, i) =>
      bulkSet.has(i) ? { ...en, isOff: true } : en
    ))
    clearBulk()
  }

  function applyBulkUnset() {
    if (bulkSet.size === 0) return
    setEntries(prev => prev.map((en, i) =>
      bulkSet.has(i) ? { ...en, isOff: null } : en
    ))
    clearBulk()
  }

  // ── 編集モード ────────────────────────────────────────────────────────────

  function enterEditMode() {
    setEntries(prev => prev.map(entry => {
      const existing = existingShifts.get(entry.date)
      // Approved shifts are locked — only populate submitted shifts
      if (existing?.status === 'submitted') {
        return {
          ...entry,
          isOff:       false,
          startTime:   existing.start_time.slice(0, 5),
          endTime:     existing.end_time.slice(0, 5),
          isOpenStart: existing.is_open_start,
          isOpenEnd:   existing.is_open_end,
        }
      }
      return { ...entry, isOff: true, startTime: '11:00', endTime: '17:00', isOpenStart: false, isOpenEnd: false }
    }))
    setIsEditMode(true)
    setSuccess(false)
    setSubmitError(null)
    setSelectedIdx(null)
    clearBulk()
  }

  function cancelEditMode() {
    setIsEditMode(false)
    setEntries(buildEntries(month, period))
    setSubmitError(null)
    setSelectedIdx(null)
    clearBulk()
  }

  // ── カレンダーグリッド構築 ─────────────────────────────────────────────────

  const firstDate = new Date(entries[0].date + 'T00:00:00')
  const startDow  = firstDate.getDay()
  const calCells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...entries.map((_, i) => i),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  // ── 送信 ──────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (hasErrors) { setSubmitError('赤い日付の時間を修正してください。'); return }
    if (!isEditMode && workingList.length === 0) {
      setSubmitError('少なくとも1日を「出勤できる」に設定してください。'); return
    }
    setSubmitError(null)

    // 送信前に確定済み（approved）エントリを保持しつつ、提出分を楽観的に反映
    const approvedEntries: [string, ExistingShift][] = [...existingShifts.entries()]
      .filter(([, v]) => v.status === 'approved')
    const committedMap = new Map<string, ExistingShift>([
      ...approvedEntries,
      ...workingList.map(en => [en.date, {
        start_time:    en.isOpenStart ? '09:00' : roundTo30Min(en.startTime),
        end_time:      en.isOpenEnd   ? '22:00' : roundTo30Min(en.endTime),
        status:        'submitted' as const,
        admin_adjusted: false,
        is_open_end:   en.isOpenEnd,
        is_open_start: en.isOpenStart,
      }] as [string, ExistingShift]),
    ])

    startTransition(async () => {
      // ── 楽観的 UI 更新（通信前に即時反映） ──────────────────────────────
      setOptimisticShifts(committedMap)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSubmitError('セッションが切れました。再ログインしてください。')
        return
      }

      if (isEditMode) {
        const workingDates   = new Set(workingList.map(en => en.date))
        const submittedDates = new Set(
          [...existingShifts.entries()]
            .filter(([, v]) => v.status === 'submitted')
            .map(([k]) => k),
        )
        const datesToDelete = [...submittedDates].filter(d => !workingDates.has(d))
        if (datesToDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('shifts')
            .delete()
            .eq('profile_id', user.id)
            .in('shift_date', datesToDelete)
          if (delErr) {
            setSubmitError('更新に失敗しました。しばらくしてから再試行してください。')
            return  // transition 終了 → 楽観的状態が自動的に元に戻る
          }
        }
      }

      if (workingList.length > 0) {
        const records = workingList.map(en => ({
          profile_id:   user.id,
          shift_date:   en.date,
          start_time:   en.isOpenStart ? '09:00' : roundTo30Min(en.startTime),
          end_time:     en.isOpenEnd   ? '22:00' : roundTo30Min(en.endTime),
          is_open_start: en.isOpenStart,
          is_open_end:  en.isOpenEnd,
          note:         null,
        }))

        const { error } = isEditMode
          ? await supabase.from('shifts').upsert(records, { onConflict: 'profile_id,shift_date' })
          : await supabase.from('shifts').insert(records)

        if (error) {
          setSubmitError(error.code === '23505'
            ? 'すでに提出済みの日付が含まれています。'
            : '送信に失敗しました。しばらくしてから再試行してください。')
          return  // transition 終了 → 楽観的状態が自動的に元に戻る
        }
      }

      // ── サーバー成功 → 実状態を確定 ────────────────────────────────────
      setExistingShifts(committedMap)
      setToastMsg(isEditMode
        ? 'シフトを更新しました。'
        : 'シフトを提出しました。\n店長の確認をお待ちください。'
      )
      setSuccess(true)
      setIsEditMode(false)
      router.refresh()
    })
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── 期間選択カード ── */}
      <div className={`card-green-lift${touchedCard === 'period' ? ' card-green-lift--touched' : ''}`} onTouchStart={() => setTouchedCard('period')}>
      <div className="card-inner" style={{ padding: '22px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '10px',
            backgroundColor: '#e5f2eb', flexShrink: 0,
          }}>
            <CalendarRange size={16} style={{ color: '#006633' }} aria-hidden />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>
              シフト希望を一括提出
            </h2>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
              期間を選び、日付をタップしてシフトを設定
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>対象月</p>
          <div className="segment-track-grid">
            {monthOptions.map(o => (
              <button key={o.value} type="button" onClick={() => changeMonth(o.value)}
                className={`segment-option py-2 ${month === o.value ? 'segment-option--active' : ''}`}>
                <span className="text-[13px] font-semibold">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, margin: 0 }}>期間</p>
          <div className="segment-track" style={{ maxWidth: '200px' }}>
            {(['first', 'second'] as Period[]).map(p => {
              const active = period === p
              return (
                <button key={p} type="button" onClick={() => changePeriod(p)}
                  className={`segment-option py-2 ${active ? 'segment-option--active' : ''}`}>
                  <span className={`text-[13px] font-semibold leading-none ${active ? 'text-gray-900' : 'text-gray-500'}`}>
                    {p === 'first' ? '前半' : '後半'}
                  </span>
                  <span className={`text-[10px] tabular-nums leading-none mt-0.5 ${active ? 'text-gray-400' : 'text-gray-400/60'}`}>
                    {p === 'first' ? `1〜15日` : `16〜${last}日`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: '12px', backgroundColor: '#e5f2eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={12} style={{ color: '#006633', flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#004d26' }}>
              {periodLabel}
              <span style={{ marginLeft: '4px', fontWeight: 500, opacity: 0.6 }}>— {entries.length}日間</span>
            </span>
          </div>
          <span style={{
            fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            padding: '2px 8px', borderRadius: '9999px',
            color: workingList.length > 0 ? '#006633' : '#9ca3af',
            backgroundColor: workingList.length > 0 ? 'rgba(0,102,51,0.12)' : 'rgba(0,0,0,0.04)',
          }}>
            {workingList.length} 日 出勤可能
          </span>
        </div>
      </div>
      </div>{/* /card-green-lift 期間 */}

      {/* ── 期限バナー ── */}
      {isPastDeadline ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '14px 16px', borderRadius: '14px',
          backgroundColor: '#fff7ed', border: '1.5px solid #fed7aa',
        }}>
          <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>🔒</span>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>
              提出期限が過ぎています
            </p>
            <p style={{ fontSize: '11px', color: '#b45309', margin: 0 }}>
              {period === 'first' ? '前半' : '後半'}の提出期限は
              <strong style={{ marginLeft: '3px' }}>{formatDeadline(deadline)}</strong> でした。
              シフトの追加・変更・削除はできません。
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '10px',
          backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
        }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            提出期限：
            <strong style={{ color: new Date() >= new Date(deadline.getTime() - 3 * 24 * 60 * 60 * 1000) ? '#d97706' : '#059669', marginLeft: '2px' }}>
              {formatDeadline(deadline)}
            </strong>
          </span>
        </div>
      )}

      {/* ── ステータスバナー ── */}
      {!fetchingExisting && !isEditMode && approvedCount > 0 && (
        <ApprovedBanner
          count={approvedCount}
          adminAdjustedCount={adminAdjustedDates.size}
        />
      )}
      {!fetchingExisting && submittedCount > 0 && !isEditMode && (
        <SubmittedBanner count={submittedCount} onReEdit={enterEditMode} />
      )}
      {isEditMode && (
        <EditModeBanner periodLabel={periodLabel} onCancel={cancelEditMode} />
      )}

      {/* ── カレンダーカード ── */}
      <div className={`card-green-lift${touchedCard === 'calendar' ? ' card-green-lift--touched' : ''}`} onTouchStart={() => setTouchedCard('calendar')}>
      <div className="card-inner" style={{
        padding: '20px 16px',
        border: `1px solid ${bulkMode ? '#bfdbfe' : 'transparent'}`,
        transition: 'border-color 200ms ease',
      }}>

        {/* カードヘッダー：一括選択トグル */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
            {bulkMode
              ? bulkSet.size > 0 ? `${bulkSet.size}日 選択中` : '日付を選択してください'
              : '日付をタップして編集'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {bulkMode && (
              <>
                <button type="button" onClick={bulkSelectAll} style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px',
                  backgroundColor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', cursor: 'pointer',
                }}>
                  全選択
                </button>
                <button type="button" onClick={bulkClearAll} style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px',
                  backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer',
                }}>
                  解除
                </button>
              </>
            )}
            {!isPastDeadline && (
              <button type="button" onClick={toggleBulkMode} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '9999px',
                backgroundColor: bulkMode ? '#374151' : '#f3f4f6',
                color: bulkMode ? '#ffffff' : '#374151',
                border: 'none', cursor: 'pointer', transition: 'all 150ms ease',
              }}>
                {bulkMode ? <><X size={11} />完了</> : <><CheckSquare size={11} />まとめて設定</>}
              </button>
            )}
          </div>
        </div>

        {/* 曜日ヘッダー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
          {DOW_LABELS.map((d, i) => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '10px', fontWeight: 700, padding: '3px 0',
              color: i === 0 ? '#f87171' : i === 6 ? '#60a5fa' : '#9ca3af',
            }}>{d}</div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {calCells.map((idx, ci) => {
            if (idx === null) return <div key={`empty-${ci}`} />
            const entry       = entries[idx]
            const entryHasErr = entry.isOff === false && entry.startTime >= entry.endTime
            return (
              <CalendarCell
                key={entry.date}
                entry={entry}
                hasError={entryHasErr}
                isSelected={!bulkMode && selectedIdx === idx}
                isBulkMode={bulkMode}
                isBulkSelected={bulkSet.has(idx)}
                serverStatus={(optimisticShifts.get(entry.date)?.status ?? null) as 'submitted' | 'approved' | null}
                adminAdjusted={optimisticShifts.get(entry.date)?.admin_adjusted ?? false}
                approvedTime={(() => {
                  const s = optimisticShifts.get(entry.date)
                  if (s?.status !== 'approved') return undefined
                  return s.is_open_start && s.is_open_end
                    ? '◎'
                    : `${s.is_open_start ? '〇' : s.start_time.slice(0,5)}〜${s.is_open_end ? '〇' : s.end_time.slice(0,5)}`
                })()}
                onClick={() => {
                  if (isPastDeadline) return
                  if (bulkMode) { toggleBulkItem(idx) }
                  else { setSelectedIdx(prev => prev === idx ? null : idx) }
                }}
              />
            )
          })}
        </div>

        {/* ── 一括操作パネル ── */}
        {bulkMode && bulkSet.size > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #e0f2fe', paddingTop: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#3b82f6', marginBottom: '10px' }}>
              選択中 {bulkSet.size}日 に適用
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {BULK_PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => applyBulkPreset(p.start, p.end, p.isOpenStart, p.isOpenEnd)}
                  className="chip-square chip-square-active">
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={applyBulkOff}
                className="chip-square chip-square-idle" style={{ fontWeight: 700 }}>
                休みにする
              </button>
              <button type="button" onClick={applyBulkUnset} style={{
                padding: '7px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', backgroundColor: 'transparent', color: '#9ca3af',
                border: '1.5px dashed #d1d5db', minHeight: '44px',
              }}>
                未選択に戻す
              </button>
            </div>
          </div>
        )}

        {/* ── 単日エディターパネル ── */}
        {!bulkMode && selectedIdx !== null && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button type="button" onClick={() => canPrev && setSelectedIdx(selectedIdx - 1)} disabled={!canPrev} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                  padding: '5px 9px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                  backgroundColor: canPrev ? '#f3f4f6' : 'transparent',
                  color: canPrev ? '#374151' : '#d1d5db', border: 'none',
                  cursor: canPrev ? 'pointer' : 'default', minHeight: '44px',
                }}>
                  <ChevronLeft size={13} /> 前日
                </button>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', padding: '0 4px' }}>
                  {(() => { const d = new Date(entries[selectedIdx].date + 'T00:00:00'); return `${d.getMonth()+1}月${d.getDate()}日` })()}
                </span>
                <button type="button" onClick={() => canNext && setSelectedIdx(selectedIdx + 1)} disabled={!canNext} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                  padding: '5px 9px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                  backgroundColor: canNext ? '#f3f4f6' : 'transparent',
                  color: canNext ? '#374151' : '#d1d5db', border: 'none',
                  cursor: canNext ? 'pointer' : 'default', minHeight: '44px',
                }}>
                  翌日 <ChevronRight size={13} />
                </button>
              </div>
              <button type="button" onClick={() => setSelectedIdx(null)} aria-label="閉じる" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '44px', height: '44px', borderRadius: '9999px',
                backgroundColor: '#f3f4f6', color: '#6b7280', border: 'none', cursor: 'pointer',
              }}>
                <X size={14} />
              </button>
            </div>
            <DayShiftCard
              entry={entries[selectedIdx]}
              onChange={updated => updateEntry(selectedIdx, updated)}
            />
          </div>
        )}

        {!bulkMode && selectedIdx === null && (
          <p style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
            日付をタップして編集 / 「まとめて設定」で複数日を一括変更
          </p>
        )}
      </div>
      </div>{/* /card-green-lift カレンダー */}

      {/* エラー */}
      {submitError && (
        <div className="alert-error" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{submitError}</span>
        </div>
      )}

      {/* 送信ボタン（期限内のみ表示） */}
      {!isPastDeadline && <div style={{ paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={success && !isEditMode ? undefined : 'btn-inverse-dark'}
          style={{
            paddingTop: '15px', paddingBottom: '15px',
            ...(success && !isEditMode ? {
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              width: '100%', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
              letterSpacing: '-0.01em', cursor: 'default',
              backgroundColor: '#d1fae5', color: '#006633', border: '2px solid #bbf7d0',
            } : {}),
          }}
        >
          {isPending ? (
            <><Loader2 size={16} className="animate-spin" aria-hidden />
              {isEditMode ? '更新中...' : '送信中...'}</>
          ) : success && !isEditMode ? (
            <><CheckCircle2 size={16} aria-hidden />提出済み</>
          ) : isEditMode ? (
            `${periodLabel} のシフトを更新（${workingList.length}日分）`
          ) : (
            `${periodLabel} のシフトを提出（${workingList.length}日分）`
          )}
        </button>
        {hasErrors && (
          <p style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#d6231e' }}>
            赤くなっている日付の時間を修正してから提出してください
          </p>
        )}
        {!hasErrors && workingList.length === 0 && !success && !isEditMode && (
          <p style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
            日付をタップまたは「まとめて設定」で出勤日を追加してください
          </p>
        )}
      </div>}

      {/* Apple 風トースト通知 */}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

    </div>
  )
}
