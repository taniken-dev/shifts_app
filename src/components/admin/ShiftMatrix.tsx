'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Check, X as XIcon,
  Download, Loader2, CheckSquare, Users,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ShiftWithProfile, ShiftStatus } from '@/types/database'
import { calcDeadline, formatDeadline, BYPASS_DEADLINE } from '@/lib/utils/deadline'
import {
  TIME_SEGMENTS, countStaffForSegment, getSegmentTarget, getSufficiencyStatus,
  isHolidayOrWeekend,
} from '@/lib/utils/shift-calculator'
import { Toast } from '@/components/ui/Toast'
import WorkScheduleExportButton from './WorkScheduleExportButton'

// ── 定数 ─────────────────────────────────────────────────────────────────────

type Period = 'first' | 'second'

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

// CSVエクスポート用（従来の2スロット）
const CSV_SLOTS = [
  { label: 'ランチ (11〜15時)',  start: '11:00', end: '15:00' },
  { label: 'ディナー (17〜21時)', start: '17:00', end: '21:00' },
] as const

// ポジション定義
const POSITIONS = [
  { value: 'R',   label: 'R',   group: 'front'   as const },
  { value: 'D/R', label: 'D/R', group: 'front'   as const },
  { value: 'D/T', label: 'D/T', group: 'front'   as const },
  { value: 'C',   label: 'C',   group: 'front'   as const },
  { value: 'F',   label: 'F',   group: 'kitchen' as const },
  { value: 'S',   label: 'S',   group: 'kitchen' as const },
  { value: 'G',   label: 'G',   group: 'kitchen' as const },
] as const

const POSITION_GROUPS = {
  front:   ['R', 'D/R', 'D/T', 'C'],
  kitchen: ['F', 'S', 'G'],
} as const

const TIME_OPTIONS: string[] = []
for (let h = 9; h <= 21; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 21) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

// ── 型 ───────────────────────────────────────────────────────────────────────

interface ShiftMatrixProps {
  staff:  Pick<Profile, 'id' | 'staff_code' | 'full_name'>[]
  shifts: ShiftWithProfile[]
  dates:  string[]
  month:  string
  period: Period
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function escapeCSV(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function ShiftMatrix({
  staff, shifts: initialShifts, dates, month, period,
}: ShiftMatrixProps) {
  const [localShifts,      setLocalShifts]      = useState<ShiftWithProfile[]>(initialShifts)
  const [bulkWorking,      setBulkWorking]      = useState(false)
  const [toastMsg,         setToastMsg]         = useState<string | null>(null)
  const [showSummary,      setShowSummary]      = useState(true)
  const [includeSubmitted, setIncludeSubmitted] = useState(true)

  // 調整ポップオーバー
  const [popoverShift,    setPopoverShift]    = useState<ShiftWithProfile | null>(null)
  const [popoverStart,    setPopoverStart]    = useState('')
  const [popoverEnd,      setPopoverEnd]      = useState('')
  const [popoverPosition, setPopoverPosition] = useState<string>('')
  const [popoverWorking,  setPopoverWorking]  = useState(false)

  const shiftMap = useMemo(() => {
    const map = new Map<string, Map<string, ShiftWithProfile>>()
    for (const shift of localShifts) {
      if (!map.has(shift.profile_id)) map.set(shift.profile_id, new Map())
      map.get(shift.profile_id)!.set(shift.shift_date, shift)
    }
    return map
  }, [localShifts])

  const submittedShifts = useMemo(
    () => localShifts.filter(s => s.status === 'submitted'),
    [localShifts],
  )
  const approvedCount = useMemo(
    () => localShifts.filter(s => s.status === 'approved').length,
    [localShifts],
  )

  const navigate = useCallback((m: string, p: Period) => {
    window.location.href = `/admin/shifts?month=${m}&period=${p}`
  }, [])

  // ── ポップオーバー操作 ─────────────────────────────────────────────────────

  function openPopover(shift: ShiftWithProfile) {
    setPopoverShift(shift)
    setPopoverStart(shift.start_time.slice(0, 5))
    setPopoverEnd(  shift.end_time.slice(0, 5))
    setPopoverPosition(shift.position ?? '')
    setPopoverWorking(false)
  }

  function closePopover() {
    setPopoverShift(null)
    setPopoverWorking(false)
  }

  async function handlePopoverApprove() {
    if (!popoverShift) return
    await _updateStatus(popoverShift.id, 'approved')
  }

  async function handlePopoverReject() {
    if (!popoverShift) return
    await _updateStatus(popoverShift.id, 'rejected')
  }

  async function _updateStatus(shiftId: string, status: 'approved' | 'rejected') {
    setPopoverWorking(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('shifts')
      .update({ status, position: popoverPosition || null })
      .eq('id', shiftId)

    if (error) {
      setToastMsg(status === 'approved' ? '承認に失敗しました。' : '却下に失敗しました。')
    } else {
      setLocalShifts(prev =>
        prev.map(s => s.id === shiftId
          ? { ...s, status: status as ShiftStatus, position: popoverPosition || null }
          : s,
        ),
      )
      setToastMsg(status === 'approved' ? '承認しました。' : '却下しました。')
      closePopover()
    }
    setPopoverWorking(false)
  }

  // 時間修正して承認
  async function handleAdjustApprove() {
    if (!popoverShift) return
    if (popoverStart >= popoverEnd) {
      setToastMsg('開始時間は終了時間より前に設定してください。')
      return
    }
    setPopoverWorking(true)

    const isAdjusted =
      popoverShift.start_time.slice(0, 5) !== popoverStart ||
      popoverShift.end_time.slice(0, 5)   !== popoverEnd

    const supabase = createClient()
    const { error } = await supabase
      .from('shifts')
      .update({
        status:         'approved',
        start_time:     popoverStart,
        end_time:       popoverEnd,
        admin_adjusted: isAdjusted,
        position:       popoverPosition || null,
      })
      .eq('id', popoverShift.id)

    if (error) {
      setToastMsg('更新に失敗しました。')
    } else {
      setLocalShifts(prev =>
        prev.map(s => s.id === popoverShift.id
          ? {
              ...s,
              status:         'approved' as ShiftStatus,
              start_time:     popoverStart,
              end_time:       popoverEnd,
              admin_adjusted: isAdjusted,
              position:       popoverPosition || null,
            }
          : s,
        ),
      )
      setToastMsg(isAdjusted ? '時間を修正して承認しました。' : '承認しました。')
      closePopover()
    }
    setPopoverWorking(false)
  }

  // ── 一括承認 ──────────────────────────────────────────────────────────────

  async function handleBulkApprove() {
    if (submittedShifts.length === 0) return
    if (!window.confirm(`${submittedShifts.length}件のシフトを一括承認しますか？`)) return

    setBulkWorking(true)
    const ids = submittedShifts.map(s => s.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('shifts')
      .update({ status: 'approved' })
      .in('id', ids)

    if (error) {
      setToastMsg('一括承認に失敗しました。')
    } else {
      setLocalShifts(prev =>
        prev.map(s => ids.includes(s.id) ? { ...s, status: 'approved' as ShiftStatus } : s),
      )
      setToastMsg(`${ids.length}件のシフトを承認しました。`)
    }
    setBulkWorking(false)
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  function downloadCSV() {
    const [y, m] = month.split('-').map(Number)
    const header = ['スタッフ', ...dates.map(d => {
      const dt = new Date(d + 'T00:00:00')
      return `${dt.getDate()}(${DOW_JA[dt.getDay()]})`
    })]
    const staffRows = staff.map(s => [
      s.full_name,
      ...dates.map(d => {
        const sh = shiftMap.get(s.id)?.get(d)
        return sh
          ? (sh.is_open_start && sh.is_open_end
              ? '◎'
              : `${sh.is_open_start ? '〇' : sh.start_time.slice(0,5)}-${sh.is_open_end ? '〇' : sh.end_time.slice(0,5)}`)
          : '—'
      }),
    ])
    const summaryRows = CSV_SLOTS.map(slot => [
      slot.label,
      ...dates.map(d => String(localShifts.filter(
        sh => sh.shift_date === d && sh.start_time < slot.end && sh.end_time > slot.start,
      ).length)),
    ])
    const csv = '\uFEFF' + [header, ...staffRows, [''], ...summaryRows]
      .map(row => row.map(escapeCSV).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `シフト表_${y}年${m}月${period === 'first' ? '前半' : '後半'}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── 表示用変数 ────────────────────────────────────────────────────────────

  const [y, m]     = month.split('-').map(Number)
  const periodLabel = period === 'first' ? `1〜15日` : `16日〜月末`

  const deadline        = useMemo(() => calcDeadline(month, period), [month, period])
  const isBeforeDeadline = useMemo(() => !BYPASS_DEADLINE && new Date() <= deadline, [deadline])

  const timesChanged = popoverShift
    ? popoverShift.start_time.slice(0, 5) !== popoverStart ||
      popoverShift.end_time.slice(0, 5)   !== popoverEnd
    : false

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── ページヘッダー ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>
            シフト管理
          </h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#9ca3af', margin: '4px 0 0' }}>
            {y}年{m}月 {periodLabel} —&nbsp;
            <span style={{ color: '#2563eb', fontWeight: 700 }}>承認待 {submittedShifts.length}件</span>
            <span style={{ margin: '0 6px', color: '#d1d5db' }}>／</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>承認済 {approvedCount}件</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={bulkWorking || submittedShifts.length === 0 || isBeforeDeadline}
            title={isBeforeDeadline ? `提出期限（${formatDeadline(deadline)}）前は承認できません` : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', borderRadius: '10px', minHeight: '44px',
              backgroundColor: (submittedShifts.length === 0 || isBeforeDeadline) ? '#f3f4f6' : '#006633',
              color:           (submittedShifts.length === 0 || isBeforeDeadline) ? '#9ca3af' : '#ffffff',
              fontSize: '13px', fontWeight: 700, border: 'none',
              cursor: (submittedShifts.length === 0 || isBeforeDeadline) ? 'default' : 'pointer',
              transition: 'all 180ms ease', opacity: bulkWorking ? 0.7 : 1,
            }}
          >
            {bulkWorking
              ? <Loader2 size={14} className="animate-spin" aria-hidden />
              : <CheckSquare size={14} aria-hidden />
            }
            一括承認（{submittedShifts.length}件）
          </button>

          <button
            type="button"
            onClick={downloadCSV}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', borderRadius: '10px', minHeight: '44px',
              backgroundColor: '#f3f4f6', color: '#374151',
              fontSize: '13px', fontWeight: 700,
              border: '1.5px solid #e5e7eb', cursor: 'pointer',
              transition: 'all 180ms ease',
            }}
          >
            <Download size={14} aria-hidden />CSVエクスポート
          </button>

          <WorkScheduleExportButton month={month} period={period} />
        </div>
      </div>

      {/* ── 提出期限バナー ── */}
      {isBeforeDeadline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', borderRadius: '12px',
          backgroundColor: '#fffbeb', border: '1.5px solid #fcd34d',
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>🔒</span>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
              提出期限前のため承認操作は無効です
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#b45309' }}>
              承認可能になるのは {formatDeadline(deadline)} 以降です
            </p>
          </div>
        </div>
      )}

      {/* ── コントロールバー ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: '14px',
        backgroundColor: '#ffffff', border: '1px solid #f1f5f9',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" onClick={() => navigate(prevMonth(month), period)} aria-label="前月"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '9px',
              backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
              cursor: 'pointer', color: '#374151', transition: 'all 150ms ease',
            }}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span style={{
            fontSize: '15px', fontWeight: 800, color: '#111827',
            letterSpacing: '-0.02em', minWidth: '96px', textAlign: 'center',
          }}>
            {y}年{m}月
          </span>
          <button type="button" onClick={() => navigate(nextMonth(month), period)} aria-label="翌月"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '9px',
              backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
              cursor: 'pointer', color: '#374151', transition: 'all 150ms ease',
            }}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>

        <div style={{
          display: 'flex', padding: '3px', gap: '2px',
          backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '10px',
        }}>
          {(['first', 'second'] as Period[]).map(p => (
            <button key={p} type="button" onClick={() => navigate(month, p)}
              style={{
                padding: '8px 20px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 180ms ease',
                backgroundColor: period === p ? '#ffffff' : 'transparent',
                color:           period === p ? '#111827' : '#6b7280',
                boxShadow:       period === p ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                minHeight: '36px',
              }}>
              {p === 'first' ? '前半（1〜15日）' : '後半（16日〜末日）'}
            </button>
          ))}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '9999px',
          backgroundColor: '#f3f4f6', fontSize: '12px', fontWeight: 600, color: '#374151',
        }}>
          <Users size={12} aria-hidden />{staff.length}名
        </div>
      </div>

      {/* ── マトリックステーブル ── */}
      {staff.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          backgroundColor: '#ffffff', borderRadius: '18px',
          border: '1px solid #f1f5f9', color: '#9ca3af', fontSize: '14px',
        }}>
          アクティブなスタッフが登録されていません
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff', borderRadius: '18px',
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.03)',
          overflow: 'clip',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <MatrixTable
              staff={staff}
              dates={dates}
              shiftMap={shiftMap}
              onCellClick={openPopover}
            />
          </div>
        </div>
      )}

      {/* ── 人員充足サマリー（トグル） ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: showSummary ? '10px' : '0' }}>
          <button
            type="button"
            onClick={() => setShowSummary(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '9999px',
              backgroundColor: showSummary ? '#f3f4f6' : '#ffffff',
              color: '#374151',
              fontSize: '12px', fontWeight: 700,
              border: '1.5px solid #e5e7eb', cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {showSummary
              ? <ChevronUp size={12} aria-hidden />
              : <ChevronDown size={12} aria-hidden />
            }
            人員充足サマリー
          </button>

          {showSummary && (
            <button
              type="button"
              onClick={() => setIncludeSubmitted(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '9999px',
                backgroundColor: includeSubmitted ? '#eff6ff' : '#ffffff',
                color: includeSubmitted ? '#1d4ed8' : '#6b7280',
                fontSize: '11px', fontWeight: 700,
                border: `1.5px solid ${includeSubmitted ? '#bfdbfe' : '#e5e7eb'}`,
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
            >
              {includeSubmitted ? '申請中を含む（シミュレーション）' : '承認済みのみ'}
            </button>
          )}

        </div>

        {showSummary && (
          <div style={{
            overflowX: 'auto',
            backgroundColor: '#ffffff', borderRadius: '14px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <SummaryTable
              dates={dates}
              localShifts={localShifts}
              includeSubmitted={includeSubmitted}
            />
          </div>
        )}
      </div>

      {/* ── 凡例 ── */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', padding: '0 2px' }}>
        {[
          { bg: '#eff6ff', border: '#bfdbfe', label: '提出済み（承認待ち）' },
          { bg: '#f0fdf4', border: '#bbf7d0', label: '承認済み' },
          { bg: '#fff1f2', border: '#fecdd3', label: '却下' },
          { bg: '#f9fafb', border: '#e5e7eb', label: '未提出' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '3px',
              backgroundColor: item.bg, border: `1.5px solid ${item.border}`, flexShrink: 0,
            }} />
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>✎</span>
          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>店長により時間調整済み</span>
        </div>
        <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 2px' }} />
        {[
          { bg: '#fee2e2', border: '#fca5a5', label: 'サマリー：人員不足' },
          { bg: '#f0fdf4', border: '#bbf7d0', label: 'サマリー：人員適正' },
          { bg: '#fef9c3', border: '#fde047', label: 'サマリー：人員過剰' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '3px',
              backgroundColor: item.bg, border: `1.5px solid ${item.border}`, flexShrink: 0,
            }} />
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

      {/* ── 調整ポップオーバー ── */}
      {popoverShift && (() => {
        return (
          <AdjustPopover
            shift={popoverShift}
            startTime={popoverStart}
            endTime={popoverEnd}
            position={popoverPosition}
            working={popoverWorking}
            timesChanged={timesChanged}
            isBeforeDeadline={isBeforeDeadline}
            deadlineLabel={formatDeadline(deadline)}
            onStartChange={setPopoverStart}
            onEndChange={setPopoverEnd}
            onPositionChange={setPopoverPosition}
            onApprove={handlePopoverApprove}
            onReject={handlePopoverReject}
            onAdjustApprove={handleAdjustApprove}
            onClose={closePopover}
          />
        )
      })()}
    </div>
  )
}

// ── マトリックステーブル ──────────────────────────────────────────────────────

interface MatrixTableProps {
  staff:       Pick<Profile, 'id' | 'staff_code' | 'full_name'>[]
  dates:       string[]
  shiftMap:    Map<string, Map<string, ShiftWithProfile>>
  onCellClick: (shift: ShiftWithProfile) => void
}

function MatrixTable({ staff, dates, shiftMap, onCellClick }: MatrixTableProps) {
  const stickyLeft:   React.CSSProperties = { position: 'sticky', left: 0, zIndex: 5 }
  const stickyTop:    React.CSSProperties = { position: 'sticky', top: 52, zIndex: 8 }
  const stickyCorner: React.CSSProperties = { position: 'sticky', top: 52, left: 0, zIndex: 20 }

  return (
    <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
      <thead>
        <tr>
          <th style={{
            ...stickyCorner,
            backgroundColor: '#f9fafb',
            padding: '10px 20px',
            fontSize: '11px', fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
            minWidth: '152px', textAlign: 'left', whiteSpace: 'nowrap',
            boxShadow: '2px 0 6px rgba(0,0,0,0.05)',
          }}>
            スタッフ
          </th>

          {dates.map(d => {
            const date  = new Date(d + 'T00:00:00')
            const dow   = date.getDay()
            const isSun = dow === 0
            const isSat = dow === 6

            return (
              <th key={d} style={{
                ...stickyTop,
                backgroundColor: isSun ? '#fef7f7' : isSat ? '#f6f9ff' : '#f9fafb',
                padding: '6px 4px', minWidth: '80px',
                textAlign: 'center',
                borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #eef0f3',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  fontSize: '15px', fontWeight: 800, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: isSun ? '#d44' : isSat ? '#46a' : '#374151',
                }}>
                  {date.getDate()}
                </div>
                <div style={{
                  fontSize: '9px', fontWeight: 600, marginTop: '2px',
                  color: isSun ? '#d44' : isSat ? '#46a' : '#9ca3af',
                }}>
                  {DOW_JA[dow]}
                </div>
              </th>
            )
          })}
        </tr>
      </thead>

      <tbody>
        {staff.map((s, si) => {
          const rowBg = si % 2 === 0 ? '#ffffff' : '#fafafa'
          return (
            <tr key={s.id}>
              <td style={{
                ...stickyLeft,
                backgroundColor: rowBg,
                padding: '6px 16px',
                borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb',
                whiteSpace: 'nowrap',
                boxShadow: '2px 0 6px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                  {s.full_name}
                </div>
                <div style={{ fontSize: '9px', color: '#b0b8c4', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>
                  {s.staff_code}
                </div>
              </td>

              {dates.map(d => {
                const shift = shiftMap.get(s.id)?.get(d)
                const dow   = new Date(d + 'T00:00:00').getDay()
                return (
                  <ShiftCell
                    key={d}
                    shift={shift}
                    rowBg={rowBg}
                    isSun={dow === 0}
                    isSat={dow === 6}
                    onClick={shift ? () => onCellClick(shift) : undefined}
                  />
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── シフトセル ────────────────────────────────────────────────────────────────

interface ShiftCellProps {
  shift?:   ShiftWithProfile
  rowBg:    string
  isSun:    boolean
  isSat:    boolean
  onClick?: () => void
}

function ShiftCell({ shift, rowBg, isSun, isSat, onClick }: ShiftCellProps) {
  const weekendTint = isSun
    ? 'rgba(220,68,68,0.025)'
    : isSat
    ? 'rgba(70,100,170,0.025)'
    : null

  const base: React.CSSProperties = {
    padding: '5px 4px', textAlign: 'center',
    borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #eef0f3',
    minWidth: '80px', verticalAlign: 'middle',
    cursor: shift ? 'pointer' : 'default',
    transition: 'background-color 100ms ease',
    userSelect: 'none',
  }

  if (!shift) {
    return (
      <td style={{ ...base, backgroundColor: weekendTint ?? rowBg, outline: 'none' }}>
        <span style={{ fontSize: '13px', color: '#e0e3e8' }}>—</span>
      </td>
    )
  }

  const timeStr    = shift.is_open_start && shift.is_open_end
    ? '◎'
    : `${shift.is_open_start ? '〇' : shift.start_time.slice(0,5)}〜${shift.is_open_end ? '〇' : shift.end_time.slice(0,5)}`
  const isAdjusted = shift.admin_adjusted
  const posGroup   = shift.position
    ? (POSITION_GROUPS.kitchen as readonly string[]).includes(shift.position) ? 'kitchen' : 'front'
    : null

  if (shift.status === 'approved') {
    return (
      <td onClick={onClick} style={{ ...base, backgroundColor: '#f0fdf4' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', lineHeight: 1.4, letterSpacing: '-0.01em' }}>
          {timeStr}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
          {shift.position && (
            <span style={{
              fontSize: '10px', fontWeight: 800,
              color: posGroup === 'kitchen' ? '#7e22ce' : '#0369a1',
              backgroundColor: posGroup === 'kitchen' ? '#fdf4ff' : '#f0f9ff',
              borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.02em',
            }}>
              {shift.position}
            </span>
          )}
          <span style={{
            fontSize: '9px', fontWeight: 700, color: '#059669',
            backgroundColor: '#d1fae5', borderRadius: '4px', padding: '1px 6px',
          }}>
            ✓ 承認済
          </span>
          {isAdjusted && (
            <span style={{
              fontSize: '8px', fontWeight: 600, color: '#0284c7',
              backgroundColor: '#e0f2fe', borderRadius: '4px', padding: '1px 5px',
            }}>
              ✎ 調整済
            </span>
          )}
        </div>
      </td>
    )
  }

  if (shift.status === 'rejected') {
    return (
      <td onClick={onClick} style={{ ...base, backgroundColor: '#fff1f2' }}>
        <div style={{
          fontSize: '11px', fontWeight: 600, color: '#be123c',
          lineHeight: 1.4, textDecoration: 'line-through', opacity: 0.7,
        }}>
          {timeStr}
        </div>
        <span style={{
          display: 'inline-block', marginTop: '5px',
          fontSize: '9px', fontWeight: 700, color: '#e11d48',
          backgroundColor: '#ffe4e6', borderRadius: '4px', padding: '1px 6px',
        }}>
          却下
        </span>
      </td>
    )
  }

  // 提出済み（承認待ち）
  return (
    <td onClick={onClick} style={{ ...base, backgroundColor: '#eff6ff' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', lineHeight: 1.4, letterSpacing: '-0.01em' }}>
        {timeStr}
      </div>
      <span style={{
        display: 'inline-block', marginTop: '4px',
        fontSize: '9px', fontWeight: 600, color: '#3b82f6',
        backgroundColor: '#dbeafe', borderRadius: '4px', padding: '1px 6px',
      }}>
        承認待ち
      </span>
    </td>
  )
}

// ── サマリーテーブル ──────────────────────────────────────────────────────────

const SUFFICIENCY_STYLES = {
  shortage: { bg: '#fee2e2', color: '#ef4444', label: '⚠ 不足' },
  ok:       { bg: '#f0fdf4', color: '#059669', label: '✓ 適正' },
  excess:   { bg: '#fef9c3', color: '#d97706', label: '+ 過剰' },
} as const

interface SummaryTableProps {
  dates:            string[]
  localShifts:      ShiftWithProfile[]
  includeSubmitted: boolean
}

function SummaryTable({ dates, localShifts, includeSubmitted }: SummaryTableProps) {
  const assignedPositions = [...new Set(localShifts.map(s => s.position).filter(Boolean))] as string[]
  const frontPositions   = assignedPositions.filter(p => (POSITION_GROUPS.front   as readonly string[]).includes(p))
  const kitchenPositions = assignedPositions.filter(p => (POSITION_GROUPS.kitchen as readonly string[]).includes(p))

  return (
    <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
      <thead>
        <tr>
          <th style={{
            position: 'sticky', left: 0,
            backgroundColor: '#f9fafb',
            padding: '11px 20px', minWidth: '170px',
            textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
            whiteSpace: 'nowrap',
          }}>
            時間帯
          </th>
          {dates.map(d => {
            const date   = new Date(d + 'T00:00:00')
            const dow    = date.getDay()
            const isSun  = dow === 0
            const isSat  = dow === 6
            const isHol  = !isSun && !isSat && isHolidayOrWeekend(d)
            return (
              <th key={d} style={{
                backgroundColor: isSun ? '#fef7f7' : (isSat || isHol) ? '#f6f9ff' : '#f9fafb',
                padding: '6px 4px', minWidth: '82px', textAlign: 'center',
                borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #eef0f3',
              }}>
                <div style={{
                  fontSize: '15px', fontWeight: 800, lineHeight: 1,
                  color: isSun ? '#d44' : (isSat || isHol) ? '#46a' : '#374151',
                }}>
                  {date.getDate()}
                </div>
                {isHol && (
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', marginTop: '2px' }}>祝</div>
                )}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {TIME_SEGMENTS.map((seg, si) => (
          <tr key={seg.key}>
            <td style={{
              position: 'sticky', left: 0,
              backgroundColor: si % 2 === 0 ? '#f8fafc' : '#f5f8fc',
              padding: '12px 20px',
              borderBottom: si < TIME_SEGMENTS.length - 1 ? '1px solid #e5e7eb' : 'none',
              borderRight: '1px solid #d1d5db',
              whiteSpace: 'nowrap',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>{seg.label}</div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>
                {seg.start}〜{seg.end === '24:00' ? '翌0:00' : seg.end}
              </div>
            </td>
            {dates.map(d => {
              const target = getSegmentTarget(seg.key, d)
              const count  = countStaffForSegment(localShifts, d, seg, includeSubmitted)
              const status = getSufficiencyStatus(count, target)
              const style  = SUFFICIENCY_STYLES[status]

              return (
                <td key={d} style={{
                  textAlign: 'center', padding: '9px 4px',
                  borderBottom: si < TIME_SEGMENTS.length - 1 ? '1px solid #e5e7eb' : 'none',
                  borderRight: '1px solid #eef0f3',
                  backgroundColor: count === 0 && target > 0 ? '#fee2e2' : style.bg,
                }}>
                  <span style={{
                    fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                    color: count === 0 && target > 0 ? '#ef4444' : style.color,
                  }}>
                    {count}
                  </span>
                  <span style={{ fontSize: '9px', color: '#9ca3af', display: 'block', marginTop: '2px' }}>
                    / {target}名
                  </span>
                  <span style={{
                    display: 'block', fontSize: '9px', fontWeight: 700, marginTop: '1px',
                    color: count === 0 && target > 0 ? '#ef4444' : style.color,
                  }}>
                    {count === 0 && target > 0 ? '✕ 0名' : style.label}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}

        {/* ── ポジション別サマリー（フロント / キッチン）── */}
        {assignedPositions.length > 0 && (() => {
          const groups = [
            { label: 'フロント', positions: frontPositions,   bg: '#f0f9ff', color: '#0369a1' },
            { label: 'キッチン', positions: kitchenPositions, bg: '#fdf4ff', color: '#7e22ce' },
          ].filter(g => g.positions.length > 0)

          return groups.map((group, gi) => (
            <tr key={group.label}>
              <td style={{
                position: 'sticky', left: 0,
                backgroundColor: gi % 2 === 0 ? '#f8fafc' : '#f5f8fc',
                padding: '11px 20px',
                borderBottom: gi < groups.length - 1 ? '1px solid #e5e7eb' : 'none',
                borderTop: gi === 0 ? '2px solid #e5e7eb' : 'none',
                borderRight: '1px solid #d1d5db',
                whiteSpace: 'nowrap',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: group.color }}>
                  {group.label}
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                  {group.positions.join(' · ')}
                </div>
              </td>
              {dates.map(d => {
                const count = localShifts.filter(sh =>
                  sh.shift_date === d && sh.position !== null &&
                  group.positions.includes(sh.position as string)
                ).length

                return (
                  <td key={d} style={{
                    textAlign: 'center', padding: '8px 4px',
                    borderBottom: gi < groups.length - 1 ? '1px solid #e5e7eb' : 'none',
                    borderTop: gi === 0 ? '2px solid #e5e7eb' : 'none',
                    borderRight: '1px solid #eef0f3',
                    backgroundColor: group.bg,
                  }}>
                    <span style={{
                      fontSize: '16px', fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      color: count === 0 ? '#d1d5db' : group.color,
                    }}>
                      {count}
                    </span>
                    <span style={{ fontSize: '9px', color: '#9ca3af', display: 'block', marginTop: '1px' }}>名</span>
                  </td>
                )
              })}
            </tr>
          ))
        })()}
      </tbody>
    </table>
  )
}

// ── 調整ポップオーバー ────────────────────────────────────────────────────────

interface AdjustPopoverProps {
  shift:              ShiftWithProfile
  startTime:          string
  endTime:            string
  position:           string
  working:            boolean
  timesChanged:       boolean
  isBeforeDeadline:   boolean
  deadlineLabel:      string
  onStartChange:      (t: string) => void
  onEndChange:        (t: string) => void
  onPositionChange:   (p: string) => void
  onApprove:          () => void
  onReject:           () => void
  onAdjustApprove:    () => void
  onClose:            () => void
}

function AdjustPopover({
  shift, startTime, endTime, position, working, timesChanged,
  isBeforeDeadline, deadlineLabel,
  onStartChange, onEndChange, onPositionChange, onApprove, onReject, onAdjustApprove, onClose,
}: AdjustPopoverProps) {
  const date      = new Date(shift.shift_date + 'T00:00:00')
  const dow       = date.getDay()
  const timeError = startTime >= endTime
  const isAdjusted = shift.admin_adjusted

  const selectStyle: React.CSSProperties = {
    flex: 1, padding: '10px 12px', borderRadius: '10px',
    fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
    backgroundColor: '#fff', appearance: 'none', cursor: 'pointer', outline: 'none',
    transition: 'border-color 120ms ease',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.36)',
        backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: '24px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.20)',
        width: '100%', maxWidth: '360px',
        padding: '24px 22px 22px',
        display: 'flex', flexDirection: 'column', gap: '18px',
        animation: 'toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontWeight: 500 }}>
              {date.getMonth() + 1}月{date.getDate()}日（{DOW_JA[dow]}）
            </p>
            <h2 style={{
              fontSize: '18px', fontWeight: 800, color: '#111827',
              margin: '3px 0 0', letterSpacing: '-0.025em',
            }}>
              {shift.profiles.full_name}
            </h2>
            {isAdjusted && (
              <p style={{ fontSize: '11px', color: '#0284c7', margin: '4px 0 0', fontWeight: 600 }}>
                ✎ 前回、時間が調整されています
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる" disabled={working}
            style={{
              background: '#f3f4f6', border: 'none', borderRadius: '9999px',
              width: '32px', height: '32px', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6b7280',
            }}>
            <XIcon size={15} aria-hidden />
          </button>
        </div>

        {/* スタッフ希望時間 */}
        <div style={{
          padding: '11px 14px', borderRadius: '12px',
          backgroundColor: '#f5f5f7', border: '1px solid #ebebeb',
        }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            スタッフ希望枠（Availability）
          </p>
          <p style={{ fontSize: '16px', fontWeight: 800, color: '#374151', margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
            {shift.start_time.slice(0, 5)} 〜 {shift.end_time.slice(0, 5)}
          </p>
        </div>

        {/* 時間調整セレクト */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            修正後の時間（任意）
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select value={startTime} onChange={e => onStartChange(e.target.value)} disabled={working}
              style={{
                ...selectStyle,
                border: timeError ? '1.5px solid #fca5a5' : '1.5px solid #e5e7eb',
                color:  timeError ? '#d6231e' : '#111827',
              }}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ color: '#d1d5db', fontSize: '14px', flexShrink: 0, userSelect: 'none' }}>—</span>
            <select value={endTime} onChange={e => onEndChange(e.target.value)} disabled={working}
              style={{
                ...selectStyle,
                border: timeError ? '1.5px solid #fca5a5' : '1.5px solid #e5e7eb',
                color:  timeError ? '#d6231e' : '#111827',
              }}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {timeError && (
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#d6231e', margin: '6px 0 0' }}>
              ⚠ 開始は終了より前に設定してください
            </p>
          )}
        </div>

        {/* ポジション選択 */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ポジション（任意）
          </p>
          <select
            value={position}
            onChange={e => onPositionChange(e.target.value)}
            disabled={working}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, color: '#111827',
              backgroundColor: '#fff', border: '1.5px solid #e5e7eb',
              appearance: 'none', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">未設定</option>
            {POSITIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* アクションボタン */}
        {isBeforeDeadline ? (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '14px', borderRadius: '12px',
            backgroundColor: '#fffbeb', border: '1.5px solid #fcd34d',
          }}>
            <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.2 }}>🔒</span>
            <div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
                提出期限前のため承認できません
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#b45309' }}>
                {deadlineLabel} 以降に操作してください
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {timesChanged ? (
              <button type="button" onClick={onAdjustApprove}
                disabled={working || timeError}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '14px 18px', borderRadius: '13px',
                  backgroundColor: timeError ? '#f3f4f6' : '#006633',
                  color:           timeError ? '#9ca3af' : '#fff',
                  fontSize: '14px', fontWeight: 700, border: 'none',
                  cursor: timeError || working ? 'default' : 'pointer',
                  transition: 'all 160ms ease', opacity: working ? 0.7 : 1,
                }}>
                {working
                  ? <Loader2 size={14} className="animate-spin" aria-hidden />
                  : <Check size={14} aria-hidden />
                }
                時間を修正して承認
              </button>
            ) : (
              <button type="button" onClick={onApprove}
                disabled={working}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '14px 18px', borderRadius: '13px',
                  backgroundColor: '#006633', color: '#fff',
                  fontSize: '14px', fontWeight: 700, border: 'none',
                  cursor: working ? 'default' : 'pointer',
                  transition: 'all 160ms ease', opacity: working ? 0.7 : 1,
                }}>
                {working
                  ? <Loader2 size={14} className="animate-spin" aria-hidden />
                  : <Check size={14} aria-hidden />
                }
                承認する
              </button>
            )}

            {shift.status !== 'rejected' && (
              <button type="button" onClick={onReject}
                disabled={working}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '12px 18px', borderRadius: '13px',
                  backgroundColor: '#fef2f2', color: '#be123c',
                  fontSize: '13px', fontWeight: 600,
                  border: '1.5px solid #fecdd3',
                  cursor: working ? 'default' : 'pointer',
                  transition: 'all 160ms ease', opacity: working ? 0.7 : 1,
                }}>
                <XIcon size={13} aria-hidden />
                却下する
              </button>
            )}
            {shift.status === 'rejected' && (
              <button type="button" onClick={onApprove}
                disabled={working}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '12px 18px', borderRadius: '13px',
                  backgroundColor: '#eff6ff', color: '#1d4ed8',
                  fontSize: '13px', fontWeight: 600,
                  border: '1.5px solid #bfdbfe',
                  cursor: working ? 'default' : 'pointer',
                  transition: 'all 160ms ease',
                }}>
                <Check size={13} aria-hidden />
                却下を取り消して承認
              </button>
            )}
          </div>
        )}

        {/* 現在のステータス注釈 */}
        <p style={{ fontSize: '11px', color: '#b0b8c4', margin: 0, textAlign: 'center' }}>
          {shift.status === 'approved' && '現在「承認済み」— 再調整できます'}
          {shift.status === 'rejected' && '現在「却下済み」'}
          {shift.status === 'submitted' && 'セルをタップして承認・調整'}
        </p>
      </div>
    </div>
  )
}
