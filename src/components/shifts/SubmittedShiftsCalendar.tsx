'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2, ChevronLeft, ChevronRight, CheckSquare, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Shift } from '@/types/database'

interface Props { shifts: Shift[] }

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

function lastDayOf(year: number, month: number) { return new Date(year, month, 0).getDate() }
function formatTime(t: string) { return t.slice(0, 5) }
function getMonths(shifts: Shift[]): string[] {
  return Array.from(new Set(shifts.map(s => s.shift_date.slice(0, 7)))).sort()
}

// ── 月カレンダー ──────────────────────────────────────────────────────────────

interface MonthCalendarProps {
  yearMonth:      string
  shifts:         Shift[]
  bulkMode:       boolean
  selectedIds:    Set<string>
  onToggleSelect: (id: string) => void
  onDelete:       (id: string) => Promise<void>
  deletingId:     string | null
}

function MonthCalendar({
  yearMonth, shifts, bulkMode, selectedIds, onToggleSelect, onDelete, deletingId,
}: MonthCalendarProps) {
  const [y, m] = yearMonth.split('-').map(Number)
  if (!y || !m || isNaN(y) || isNaN(m)) return null
  const last   = lastDayOf(y, m)

  const byDate = new Map<string, Shift>()
  for (const s of shifts) byDate.set(s.shift_date, s)

  const firstDow = new Date(y, m - 1, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: last }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="card-green-lift">
    <div className="card-inner" style={{
      padding: '20px 16px',
      border: `1px solid ${bulkMode ? '#fecaca' : 'transparent'}`,
      transition: 'border-color 200ms ease',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', marginBottom: '14px' }}>
        {y}年{m}月
      </h3>

      {/* 曜日 */}
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
        {cells.map((day, ci) => {
          if (day === null) return <div key={`e-${ci}`} />

          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const shift   = byDate.get(dateStr)
          const dow     = (firstDow + day - 1) % 7
          const isSun   = dow === 0
          const isSat   = dow === 6
          const numColor = isSun ? '#d6231e' : isSat ? '#3b82f6' : '#111827'

          // シフトなし
          if (!shift) {
            return (
              <div key={dateStr} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '56px', padding: '6px 2px', borderRadius: '10px', backgroundColor: '#f9fafb',
              }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{day}</span>
              </div>
            )
          }

          const isSelected = selectedIds.has(shift.id)
          const canEdit    = shift.status === 'submitted'

          const cellBg = isSelected
            ? '#fff1f2'
            : '#f0fdf4'

          const cellBorder = isSelected
            ? '2px solid #f87171'
            : '1.5px solid #bbf7d0'

          return (
            <div
              key={dateStr}
              onClick={() => bulkMode && canEdit && onToggleSelect(shift.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'space-between', minHeight: '64px',
                padding: '6px 3px 5px', borderRadius: '12px',
                backgroundColor: cellBg, border: cellBorder,
                position: 'relative', cursor: bulkMode && canEdit ? 'pointer' : 'default',
                transition: 'all 120ms ease',
              }}
            >
              {/* 一括モード：チェックサークル */}
              {bulkMode && canEdit && (
                <div style={{
                  position: 'absolute', top: '3px', left: '3px',
                  width: '13px', height: '13px', borderRadius: '50%',
                  backgroundColor: isSelected ? '#ef4444' : 'transparent',
                  border: isSelected ? '2px solid #ef4444' : '2px solid #d1d5db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#fff' }} />}
                </div>
              )}

              <span style={{ fontSize: '16px', fontWeight: 800, color: numColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{day}</span>
              <span style={{ fontSize: '8px', fontWeight: 700, color: '#006633', textAlign: 'center', lineHeight: 1.3 }}>
                {shift.is_open_start && shift.is_open_end
                  ? '◎'
                  : <>{shift.is_open_start ? '〇' : formatTime(shift.start_time)}〜<br />{shift.is_open_end ? '〇' : formatTime(shift.end_time)}</>}
              </span>

              {/* 通常モード削除ボタン */}
              {!bulkMode && canEdit && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(shift.id) }}
                  disabled={deletingId === shift.id}
                  aria-label="削除"
                  style={{
                    position: 'absolute', top: '3px', right: '3px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '17px', height: '17px', borderRadius: '50%',
                    backgroundColor: '#e5e7eb', color: '#6b7280', border: 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  {deletingId === shift.id
                    ? <Loader2 size={8} className="animate-spin" />
                    : <Trash2 size={8} />
                  }
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function SubmittedShiftsCalendar({ shifts: initialShifts }: Props) {
  const router                      = useRouter()
  const [shifts, setShifts]         = useState<Shift[]>(initialShifts)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkMode,  setBulkMode]    = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const months        = getMonths(shifts)
  const [monthIdx, setMonthIdx] = useState(0)
  const safeMonthIdx  = Math.min(monthIdx, Math.max(0, months.length - 1))
  const currentMonth  = months[safeMonthIdx] ?? ''

  // 現在月のシフト（削除可能なもの）
  const currentShifts = shifts.filter(s => s.shift_date.startsWith(currentMonth))
  const deletableIds  = currentShifts.filter(s => s.status === 'submitted').map(s => s.id)

  function toggleBulkMode() {
    if (bulkMode) { setBulkMode(false); setSelectedIds(new Set()) }
    else { setBulkMode(true); setSelectedIds(new Set()) }
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }
  function selectAll() { setSelectedIds(new Set(deletableIds)) }
  function clearAll()  { setSelectedIds(new Set()) }

  async function handleDelete(id: string) {
    if (!confirm('このシフト希望を削除しますか？')) return
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (!error) { setShifts(prev => prev.filter(s => s.id !== id)); router.refresh() }
    setDeletingId(null)
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`選択した ${selectedIds.size} 件のシフトを削除しますか？`)) return
    setBulkDeleting(true)

    const supabase = createClient()
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('shifts').delete().in('id', ids)
    if (!error) {
      setShifts(prev => prev.filter(s => !selectedIds.has(s.id)))
      setBulkMode(false); setSelectedIds(new Set())
      router.refresh()
    }
    setBulkDeleting(false)
  }

  if (shifts.length === 0) {
    return (
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '20px', padding: '48px 20px',
        textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: '1px solid #f1f5f9', color: '#9ca3af',
      }}>
        <p style={{ fontSize: '14px' }}>提出済みのシフトはありません</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* コントロールバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* 月ナビ */}
        {months.length > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button type="button" onClick={() => setMonthIdx(i => Math.max(0, i - 1))}
              disabled={monthIdx === 0} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '30px', height: '30px', borderRadius: '9999px',
                backgroundColor: monthIdx === 0 ? '#f3f4f6' : '#e5e7eb',
                color: monthIdx === 0 ? '#d1d5db' : '#374151',
                border: 'none', cursor: monthIdx === 0 ? 'default' : 'pointer',
              }}><ChevronLeft size={15} /></button>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151', minWidth: '72px', textAlign: 'center' }}>
              {(() => { const [y, mo] = currentMonth.split('-').map(Number); return `${y}年${mo}月` })()}
            </span>
            <button type="button"
              onClick={() => setMonthIdx(i => Math.min(months.length - 1, i + 1))}
              disabled={monthIdx === months.length - 1} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '30px', height: '30px', borderRadius: '9999px',
                backgroundColor: monthIdx === months.length - 1 ? '#f3f4f6' : '#e5e7eb',
                color: monthIdx === months.length - 1 ? '#d1d5db' : '#374151',
                border: 'none', cursor: monthIdx === months.length - 1 ? 'default' : 'pointer',
              }}><ChevronRight size={15} /></button>
          </div>
        ) : (
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>
            {(() => { const [y, mo] = currentMonth.split('-').map(Number); return `${y}年${mo}月` })()}
          </span>
        )}

        {/* 一括削除トグル */}
        {deletableIds.length > 0 && (
          <button type="button" onClick={toggleBulkMode} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '9999px',
            backgroundColor: bulkMode ? '#374151' : '#f3f4f6',
            color: bulkMode ? '#ffffff' : '#374151',
            border: 'none', cursor: 'pointer', transition: 'all 150ms ease',
          }}>
            {bulkMode ? <><X size={11} />完了</> : <><CheckSquare size={11} />まとめて削除</>}
          </button>
        )}
      </div>

      {/* 一括選択コントロール */}
      {bulkMode && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: '12px', backgroundColor: '#fff1f2',
          border: '1px solid #fecaca',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
              {selectedIds.size > 0 ? `${selectedIds.size}件 選択中` : 'シフトを選択してください'}
            </span>
            <button type="button" onClick={selectAll} style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '9999px',
              backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer',
            }}>全選択</button>
            <button type="button" onClick={clearAll} style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '9999px',
              backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer',
            }}>解除</button>
          </div>

          <button type="button" onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkDeleting} style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
              cursor: selectedIds.size === 0 || bulkDeleting ? 'not-allowed' : 'pointer',
              backgroundColor: selectedIds.size === 0 ? '#e5e7eb' : '#dc2626',
              color: selectedIds.size === 0 ? '#9ca3af' : '#ffffff',
              border: 'none', transition: 'all 150ms ease',
            }}>
            {bulkDeleting
              ? <><Loader2 size={13} className="animate-spin" />削除中...</>
              : <><Trash2 size={13} />{selectedIds.size > 0 ? `${selectedIds.size}件を削除` : '削除'}</>
            }
          </button>
        </div>
      )}

      <MonthCalendar
        yearMonth={currentMonth}
        shifts={currentShifts}
        bulkMode={bulkMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onDelete={handleDelete}
        deletingId={deletingId}
      />

      {!bulkMode && (
        <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
          緑のセルの × で個別削除 / 「まとめて削除」で複数選択
        </p>
      )}
    </div>
  )
}
