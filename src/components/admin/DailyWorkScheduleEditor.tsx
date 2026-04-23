'use client'

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Save, Loader2, X, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ShiftWithProfile } from '@/types/database'
import { Toast } from '@/components/ui/Toast'
import { upsertConfirmedShift, deleteConfirmedShift } from '@/app/actions/schedule'
import WorkScheduleExportButton from './WorkScheduleExportButton'

// ── 定数 ──────────────────────────────────────────────────────────────────────

const TL_START = 7    // タイムライン開始 07:00
const TL_END   = 22   // タイムライン終了 22:00
const TL_MINS  = (TL_END - TL_START) * 60  // 900 分

const HOUR_MARKS = Array.from(
  { length: TL_END - TL_START + 1 },
  (_, i) => TL_START + i,
)

const POSITIONS = [
  { value: 'R',    label: 'R（レジ）' },
  { value: 'D/R',  label: 'D/R（DT レジ）' },
  { value: 'D/T',  label: 'D/T（DT 接客）' },
  { value: 'C',    label: 'C（カウンター）' },
  { value: 'F',    label: 'F（フライヤー）' },
  { value: 'S',    label: 'S（セッター）' },
  { value: 'G',    label: 'G（グリル）' },
  { value: 'PREP', label: '仕込み' },
  { value: 'MAINT',label: 'メンテ（閉店作業）' },
] as const

const TIME_OPTIONS: string[] = []
for (let h = TL_START; h <= TL_END; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < TL_END) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

// ── ユーティリティ ─────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m - TL_START * 60
}

function minsToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(TL_MINS, mins))
  const total   = TL_START * 60 + clamped
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapTo30(mins: number): number {
  return Math.round(mins / 30) * 30
}

function toLeft(startMins: number): string {
  return `${Math.max(0, (startMins / TL_MINS) * 100).toFixed(3)}%`
}

function toWidth(startMins: number, endMins: number): string {
  return `${Math.max(0, ((endMins - startMins) / TL_MINS) * 100).toFixed(3)}%`
}

// ── 型 ────────────────────────────────────────────────────────────────────────

interface CShift {
  localId:   string
  dbId?:     string
  profileId: string
  startMins: number
  endMins:   number
  position:  string | null
  isDirty:   boolean
}

type DragMode = 'create' | 'move' | 'resize-l' | 'resize-r'

interface DragState {
  mode:           DragMode
  localId:        string
  rowEl:          HTMLDivElement
  mouseStartMins: number
  barStartMins:   number
  barEndMins:     number
}

interface PopoverState {
  localId:  string
  anchorEl: HTMLElement
}

export interface DailyWorkScheduleEditorProps {
  date:            string
  allProfiles:     Pick<Profile, 'id' | 'full_name' | 'staff_code'>[]
  requestedShifts: ShiftWithProfile[]
  confirmedShifts: ShiftWithProfile[]
}

// ── ヘルパー: ShiftWithProfile → CShift 変換 ─────────────────────────────────

function toLocalShift(s: ShiftWithProfile): CShift {
  return {
    localId:   s.id,
    dbId:      s.id,
    profileId: s.profile_id,
    startMins: timeToMins(s.start_time.slice(0, 5)),
    endMins:   timeToMins(s.end_time.slice(0, 5)),
    position:  s.position,
    isDirty:   false,
  }
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function DailyWorkScheduleEditor({
  date:            initDate,
  allProfiles,
  requestedShifts: initReq,
  confirmedShifts: initConf,
}: DailyWorkScheduleEditorProps) {
  const supabase = createClient()

  // ── State ─────────────────────────────────────────────────────────────────
  const [date,      setDate]      = useState(initDate)
  const [requested, setRequested] = useState<ShiftWithProfile[]>(initReq)
  const [confirmed, setConfirmed] = useState<CShift[]>(() => initConf.map(toLocalShift))
  const [popover,   setPopover]   = useState<PopoverState | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [toast,     setToast]     = useState<string | null>(null)
  const [addProfId, setAddProfId] = useState('')

  const dragRef         = useRef<DragState | null>(null)
  const isDragging      = useRef(false)
  const touchStartRef   = useRef<{ x: number; y: number; profileId: string; rowEl: HTMLDivElement } | null>(null)

  // ── 日付ナビ ──────────────────────────────────────────────────────────────
  const dateObj    = parseISO(date)
  const dateLabel  = format(dateObj, 'yyyy年M月d日（E）', { locale: ja })

  const navigateTo = useCallback(async (newDate: string) => {
    setLoading(true)
    setPopover(null)
    setDate(newDate)

    const [reqRes, confRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('*, profiles(staff_code, full_name)')
        .eq('shift_date', newDate)
        .eq('status', 'submitted'),
      supabase
        .from('shifts')
        .select('*, profiles(staff_code, full_name)')
        .eq('shift_date', newDate)
        .eq('status', 'approved'),
    ])

    setRequested(((reqRes.data ?? []) as ShiftWithProfile[]).map(s => ({
      ...s,
      start_time: s.start_time.slice(0, 5),
      end_time:   s.end_time.slice(0, 5),
    })))
    setConfirmed(((confRes.data ?? []) as ShiftWithProfile[]).map(s => toLocalShift({
      ...s,
      start_time: s.start_time.slice(0, 5),
      end_time:   s.end_time.slice(0, 5),
    })))
    setLoading(false)
  }, [supabase])

  // ── 表示対象スタッフ（希望 or 確定 のある人） ──────────────────────────────
  const visibleProfiles = useMemo(() => {
    const ids = new Set([
      ...requested.map(s => s.profile_id),
      ...confirmed.map(s => s.profileId),
    ])
    return allProfiles.filter(p => ids.has(p.id))
  }, [allProfiles, requested, confirmed])

  const unlistedProfiles = useMemo(
    () => allProfiles.filter(p => !visibleProfiles.find(vp => vp.id === p.id)),
    [allProfiles, visibleProfiles],
  )

  // ── ドラッグ: x 座標 → タイムライン分換算 ─────────────────────────────────
  const clientXToMins = useCallback((clientX: number, rowEl: HTMLDivElement) => {
    const rect = rowEl.getBoundingClientRect()
    const raw  = ((clientX - rect.left) / rect.width) * TL_MINS
    return snapTo30(Math.max(0, Math.min(TL_MINS, raw)))
  }, [])

  // ── グローバルポインターイベント（マウス + タッチ共通） ───────────────────
  useEffect(() => {
    const applyMove = (clientX: number) => {
      const drag = dragRef.current
      if (!drag) return
      isDragging.current = true

      const curMins = clientXToMins(clientX, drag.rowEl)
      const delta   = curMins - drag.mouseStartMins

      setConfirmed(prev => prev.map(s => {
        if (s.localId !== drag.localId) return s
        switch (drag.mode) {
          case 'create':
            return {
              ...s,
              startMins: Math.min(drag.barStartMins, curMins),
              endMins:   Math.max(drag.barStartMins + 30, curMins),
              isDirty:   true,
            }
          case 'move': {
            const dur      = drag.barEndMins - drag.barStartMins
            const newStart = Math.max(0, Math.min(TL_MINS - dur, snapTo30(drag.barStartMins + delta)))
            return { ...s, startMins: newStart, endMins: newStart + dur, isDirty: true }
          }
          case 'resize-l':
            return {
              ...s,
              startMins: Math.max(0, Math.min(s.endMins - 30, snapTo30(drag.barStartMins + delta))),
              isDirty:   true,
            }
          case 'resize-r':
            return {
              ...s,
              endMins: Math.min(TL_MINS, Math.max(s.startMins + 30, snapTo30(drag.barEndMins + delta))),
              isDirty:  true,
            }
          default:
            return s
        }
      }))
    }

    const applyEnd = () => {
      const drag = dragRef.current
      if (!drag) return

      // 'create' モードで 30 分未満のドラッグは削除
      if (drag.mode === 'create') {
        setConfirmed(prev => {
          const s = prev.find(x => x.localId === drag.localId)
          if (s && s.endMins - s.startMins < 30) {
            return prev.filter(x => x.localId !== drag.localId)
          }
          return prev
        })
      }

      dragRef.current = null
      setTimeout(() => { isDragging.current = false }, 50)
    }

    const onMouseMove = (e: MouseEvent) => applyMove(e.clientX)
    const onMouseUp   = () => applyEnd()
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return
      e.preventDefault() // ドラッグ中はスクロールを阻止
      applyMove(e.touches[0].clientX)
    }
    const onTouchEnd = () => applyEnd()

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend',  onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend',  onTouchEnd)
    }
  }, [clientXToMins])

  // ── 行背景クリック → 新規確定シフト作成 ──────────────────────────────────
  const handleRowMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    profileId: string,
  ) => {
    if (e.button !== 0) return
    // バー要素またはその子要素ならスキップ
    if ((e.target as HTMLElement).closest('[data-shift-bar]')) return

    const rowEl     = e.currentTarget as HTMLDivElement
    const startMins = clientXToMins(e.clientX, rowEl)

    // クリック位置が既存の確定バーと重なる場合は新規作成しない（端の誤クリック防止）
    const EDGE_GUARD = 15  // minutes（端から±15分以内はバー操作とみなす）
    const overlapsBar = confirmed.some(s =>
      s.profileId === profileId &&
      startMins >= s.startMins - EDGE_GUARD &&
      startMins <= s.endMins   + EDGE_GUARD
    )
    if (overlapsBar) return
    const tempId   = `new-${Date.now()}`

    const newShift: CShift = {
      localId:   tempId,
      profileId,
      startMins,
      endMins:   Math.min(TL_MINS, snapTo30(startMins + 60)),
      position:  null,
      isDirty:   true,
    }

    setConfirmed(prev => [...prev, newShift])
    dragRef.current = {
      mode:           'create',
      localId:        tempId,
      rowEl,
      mouseStartMins: startMins,
      barStartMins:   startMins,
      barEndMins:     snapTo30(startMins + 60),
    }
    e.preventDefault()
  }, [clientXToMins])

  // ── 行背景タッチ開始（スクロール許可のため preventDefault しない） ────────
  const handleRowTouchStart = useCallback((
    e: React.TouchEvent<HTMLDivElement>,
    profileId: string,
  ) => {
    if ((e.target as HTMLElement).closest('[data-shift-bar]')) return
    const touch = e.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      profileId,
      rowEl: e.currentTarget as HTMLDivElement,
    }
  }, [])

  // ── 行背景タッチ終了：わずかな移動 → タップ → シフト追加 ─────────────────
  const handleRowTouchEnd = useCallback((
    e: React.TouchEvent<HTMLDivElement>,
    profileId: string,
  ) => {
    const ts = touchStartRef.current
    touchStartRef.current = null
    if (!ts || ts.profileId !== profileId) return
    if ((e.target as HTMLElement).closest('[data-shift-bar]')) return

    const touch = e.changedTouches[0]
    const dx = Math.abs(touch.clientX - ts.x)
    const dy = Math.abs(touch.clientY - ts.y)
    if (dx > 8 || dy > 8) return // スワイプ操作 → シフト追加しない

    const startMins = clientXToMins(touch.clientX, ts.rowEl)
    const EDGE_GUARD = 15
    const overlapsBar = confirmed.some(s =>
      s.profileId === profileId &&
      startMins >= s.startMins - EDGE_GUARD &&
      startMins <= s.endMins   + EDGE_GUARD
    )
    if (overlapsBar) return

    const tempId = `new-${Date.now()}`
    setConfirmed(prev => [...prev, {
      localId:   tempId,
      profileId,
      startMins,
      endMins:   Math.min(TL_MINS, snapTo30(startMins + 60)),
      position:  null,
      isDirty:   true,
    }])
  }, [clientXToMins, confirmed])

  // ── バー上のマウスダウン → 移動 / リサイズ ───────────────────────────────
  const handleBarMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    shift: CShift,
    mode: 'move' | 'resize-l' | 'resize-r',
  ) => {
    if (e.button !== 0) return

    const rowEl = e.currentTarget.closest('[data-timeline-row]') as HTMLDivElement | null
    if (!rowEl) return

    dragRef.current = {
      mode,
      localId:        shift.localId,
      rowEl,
      mouseStartMins: clientXToMins(e.clientX, rowEl),
      barStartMins:   shift.startMins,
      barEndMins:     shift.endMins,
    }
    e.preventDefault()
    e.stopPropagation()
  }, [clientXToMins])

  // ── バー上のタッチ開始 → 移動 / リサイズ（ドラッグ中はスクロール阻止） ───
  const handleBarTouchStart = useCallback((
    e: React.TouchEvent<HTMLDivElement>,
    shift: CShift,
    mode: 'move' | 'resize-l' | 'resize-r',
  ) => {
    e.preventDefault()   // バーへのタッチはスクロールではなくドラッグとして扱う
    e.stopPropagation()
    const rowEl = e.currentTarget.closest('[data-timeline-row]') as HTMLDivElement | null
    if (!rowEl) return
    dragRef.current = {
      mode,
      localId:        shift.localId,
      rowEl,
      mouseStartMins: clientXToMins(e.touches[0].clientX, rowEl),
      barStartMins:   shift.startMins,
      barEndMins:     shift.endMins,
    }
  }, [clientXToMins])

  // ── バークリック → ポップオーバー ─────────────────────────────────────────
  const handleBarClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    localId: string,
  ) => {
    if (isDragging.current) return
    setPopover({ localId, anchorEl: e.currentTarget })
    e.stopPropagation()
  }, [])

  // ── バータッチ終了：ドラッグしていなければポップオーバーを開く ────────────
  const handleBarTouchEnd = useCallback((
    e: React.TouchEvent<HTMLDivElement>,
    localId: string,
  ) => {
    if (isDragging.current) return
    setPopover({ localId, anchorEl: e.currentTarget })
    e.stopPropagation()
  }, [])

  // ── 確定シフトの編集ヘルパー ──────────────────────────────────────────────
  const updateShift = useCallback((localId: string, patch: Partial<CShift>) => {
    setConfirmed(prev => prev.map(s =>
      s.localId === localId ? { ...s, ...patch, isDirty: true } : s,
    ))
  }, [])

  const deleteShift = useCallback(async (localId: string) => {
    const target = confirmed.find(s => s.localId === localId)
    if (target?.dbId) {
      try {
        await deleteConfirmedShift(target.dbId)
      } catch (e) {
        setToast(`削除エラー: ${(e as Error).message}`)
        return
      }
    }
    setConfirmed(prev => prev.filter(s => s.localId !== localId))
    setPopover(null)
  }, [confirmed])

  // ── スタッフ手動追加 ──────────────────────────────────────────────────────
  const addStaffRow = useCallback(() => {
    if (!addProfId) return
    const tempId = `new-${Date.now()}`
    setConfirmed(prev => [...prev, {
      localId:   tempId,
      profileId: addProfId,
      startMins: timeToMins('09:00'),
      endMins:   timeToMins('14:00'),
      position:  null,
      isDirty:   true,
    }])
    setAddProfId('')
  }, [addProfId])

  // ── 保存（Server Action 経由で Service Role を使用） ─────────────────────
  const handleSave = useCallback(async () => {
    const dirty = confirmed.filter(s => s.isDirty)
    if (dirty.length === 0) {
      setToast('変更はありません')
      return
    }
    setSaving(true)
    const errors: string[] = []

    for (const s of dirty) {
      try {
        const { id } = await upsertConfirmedShift({
          dbId:      s.dbId,
          profileId: s.profileId,
          shiftDate: date,
          startTime: minsToTime(s.startMins),
          endTime:   minsToTime(s.endMins),
          position:  s.position,
        })
        setConfirmed(prev => prev.map(x =>
          x.localId === s.localId
            ? { ...x, dbId: id, localId: x.dbId ? x.localId : id, isDirty: false }
            : x,
        ))
      } catch (e) {
        errors.push((e as Error).message)
      }
    }

    setSaving(false)
    if (errors.length > 0) {
      setToast(`保存エラー: ${errors[0]}`)
    } else {
      setToast(`${dirty.length}件の確定シフトを保存しました`)
    }
  }, [confirmed, date])

  // ── ポップオーバー対象シフト ──────────────────────────────────────────────
  const editingShift = popover ? confirmed.find(s => s.localId === popover.localId) : null
  const hasDirty     = confirmed.some(s => s.isDirty)

  // ── 凡例色 ────────────────────────────────────────────────────────────────
  const STORE_OPEN_L  = ((9  - TL_START) / (TL_END - TL_START)) * 100
  const STORE_CLOSE_L = ((21 - TL_START) / (TL_END - TL_START)) * 100

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm">

      {/* ── ヘッダー ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3">
        {/* 日付ナビ */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo(format(subDays(dateObj, 1), 'yyyy-MM-dd'))}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-700 transition-colors hover:bg-gray-100"
            aria-label="前日"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="min-w-[220px] text-center text-sm font-medium tabular-nums tracking-[-0.01em] text-gray-900">
            {dateLabel}
          </h2>
          <button
            onClick={() => navigateTo(format(addDays(dateObj, 1), 'yyyy-MM-dd'))}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-700 transition-colors hover:bg-gray-100"
            aria-label="翌日"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* スタッフ追加 + 保存 */}
        <div className="flex items-center gap-2 flex-wrap">
          {unlistedProfiles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={addProfId}
                onChange={e => setAddProfId(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 outline-none transition-colors focus:border-[#006633]"
              >
                <option value="">スタッフを追加...</option>
                {unlistedProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
              <button
                onClick={addStaffRow}
                disabled={!addProfId}
                className="flex items-center gap-1 rounded-md border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-40"
              >
                <UserPlus className="w-3.5 h-3.5" />追加
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasDirty}
            className="flex items-center gap-1.5 rounded-md border border-[#0a7a45] bg-[#006633] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#004d26] disabled:opacity-50"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />
            }
            保存
          </button>

          <WorkScheduleExportButton date={date} />
        </div>
      </div>

      {/* ── 凡例 ── */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-gray-300 bg-gray-200" />
          希望時間（ガイド）
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm bg-[#006633]" />
          確定シフト
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          タイムライン上をドラッグして確定シフトを作成・編集できます
        </span>
      </div>

      {/* ── タイムライン ── */}
      <div
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* スマホでも横スクロールが必要な幅を確保 */}
        <div style={{ minWidth: '800px' }}>

          {/* 時間軸ヘッダー */}
          <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white shadow-sm">
            <div className="shrink-0 border-r border-gray-200 px-3 py-2 text-xs font-medium text-gray-500" style={{ width: '144px' }}>
              スタッフ
            </div>
            <div className="flex-1 relative h-8">
              {HOUR_MARKS.map(h => (
                <div
                  key={h}
                  className="absolute top-0 flex flex-col items-start select-none"
                  style={{ left: `${((h - TL_START) / (TL_END - TL_START)) * 100}%` }}
                >
                  <div className={`w-px h-3 ${
                    h === 9 || h === 21 ? 'bg-green-300' : 'bg-gray-200'
                  }`} />
                  <span className={`text-[10px] ml-0.5 ${
                    h === 9 || h === 21 ? 'font-medium text-green-700' : 'text-gray-500'
                  }`}>
                    {h}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ローディング */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : visibleProfiles.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              この日に希望シフトを提出したスタッフはいません。<br />
              上の「スタッフを追加」から手動で追加できます。
            </div>
          ) : (
            visibleProfiles.map(profile => {
              const reqBars  = requested.filter(s => s.profile_id === profile.id)
              const confBars = confirmed.filter(s => s.profileId  === profile.id)

              return (
                <div key={profile.id} className="group flex border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70">
                  {/* スタッフ名列 */}
                  <div className="flex shrink-0 flex-col justify-center border-r border-gray-200 bg-gray-50 px-3 py-2" style={{ width: '144px' }}>
                    <div className="truncate text-sm font-medium text-gray-900">{profile.full_name}</div>
                    <div className="text-[11px] text-gray-500">{profile.staff_code}</div>
                  </div>

                  {/* タイムライン列 */}
                  <div
                    className="flex-1 relative select-none"
                    style={{ height: '72px', cursor: 'crosshair', touchAction: 'pan-x' }}
                    data-timeline-row
                    onMouseDown={e => handleRowMouseDown(e, profile.id)}
                    onTouchStart={e => handleRowTouchStart(e, profile.id)}
                    onTouchEnd={e => handleRowTouchEnd(e, profile.id)}
                  >
                    {/* 開店時間帯の背景 */}
                    <div
                      className="absolute top-0 bottom-0 bg-green-50"
                      style={{
                        left:  `${STORE_OPEN_L.toFixed(3)}%`,
                        width: `${(STORE_CLOSE_L - STORE_OPEN_L).toFixed(3)}%`,
                      }}
                    />

                    {/* 時間グリッド縦線 */}
                    {HOUR_MARKS.map(h => (
                      <div
                        key={h}
                        className={`absolute top-0 bottom-0 w-px pointer-events-none ${
                          h === 9 || h === 21
                            ? 'bg-green-300'
                            : h % 2 === 0
                            ? 'bg-gray-100'
                            : 'bg-gray-50'
                        }`}
                        style={{ left: `${((h - TL_START) / (TL_END - TL_START)) * 100}%` }}
                      />
                    ))}

                    {/* 希望バー（薄い黄色・上段） */}
                    {reqBars.map(s => (
                      <div
                        key={s.id}
                        className="pointer-events-none absolute rounded border border-gray-300 bg-gray-200/70"
                        style={{
                          top:    '6px',
                          height: '22px',
                          left:   toLeft(timeToMins(s.start_time)),
                          width:  toWidth(timeToMins(s.start_time), timeToMins(s.end_time)),
                        }}
                        title={`希望: ${s.start_time}〜${s.end_time}`}
                      >
                        <span className="mt-1 block truncate px-1 text-[9px] leading-none text-gray-600">
                          {s.start_time}〜{s.end_time}
                        </span>
                      </div>
                    ))}

                    {/* 確定バー（緑・下段） */}
                    {confBars.map(s => (
                      <ConfirmedBar
                        key={s.localId}
                        shift={s}
                        onBarMouseDown={handleBarMouseDown}
                        onBarClick={handleBarClick}
                        onBarTouchStart={handleBarTouchStart}
                        onBarTouchEnd={handleBarTouchEnd}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── 編集ポップオーバー ── */}
      {popover && editingShift && (
        <>
          {/* バックドロップ */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPopover(null)}
          />
          {/* ポップオーバー本体 */}
          <EditPopover
            shift={editingShift}
            anchorEl={popover.anchorEl}
            onUpdate={updateShift}
            onDelete={deleteShift}
            onClose={() => setPopover(null)}
          />
        </>
      )}

      {/* ── トースト ── */}
      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

// ── 確定シフトバー ─────────────────────────────────────────────────────────────

function ConfirmedBar({
  shift,
  onBarMouseDown,
  onBarClick,
  onBarTouchStart,
  onBarTouchEnd,
}: {
  shift:           CShift
  onBarMouseDown:  (e: React.MouseEvent<HTMLDivElement>, shift: CShift, mode: 'move' | 'resize-l' | 'resize-r') => void
  onBarClick:      (e: React.MouseEvent<HTMLDivElement>, localId: string) => void
  onBarTouchStart: (e: React.TouchEvent<HTMLDivElement>, shift: CShift, mode: 'move' | 'resize-l' | 'resize-r') => void
  onBarTouchEnd:   (e: React.TouchEvent<HTMLDivElement>, localId: string) => void
}) {
  const detectMode = (clientX: number, rect: DOMRect): 'resize-l' | 'resize-r' | 'move' => {
    const relX = clientX - rect.left
    const w    = rect.width
    const handleZone = Math.min(36, w * 0.35)
    if (relX <= handleZone)       return 'resize-l'
    if (relX >= w - handleZone)   return 'resize-r'
    return 'move'
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    onBarMouseDown(e, shift, detectMode(e.clientX, e.currentTarget.getBoundingClientRect()))
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    onBarTouchStart(e, shift, detectMode(e.touches[0].clientX, e.currentTarget.getBoundingClientRect()))
  }

  return (
    <div
      data-shift-bar
      className={`absolute flex items-center overflow-hidden rounded-md border shadow-[0_2px_8px_rgba(0,0,0,0.28)] group/bar ${
        shift.isDirty
          ? 'border-[#1f9d62] bg-[#0f8a50]'
          : 'border-[#0a7a45] bg-[#006633]'
      }`}
      style={{
        top:         '38px',
        height:      '26px',
        left:        toLeft(shift.startMins),
        width:       toWidth(shift.startMins, shift.endMins),
        cursor:      'grab',
        minWidth:    '4px',
        touchAction: 'none', // バーへのタッチはドラッグとして扱う
      }}
      onMouseDown={handleMouseDown}
      onClick={e => onBarClick(e, shift.localId)}
      onTouchStart={handleTouchStart}
      onTouchEnd={e => onBarTouchEnd(e, shift.localId)}
    >
      {/* 左リサイズハンドル */}
      <div
        className="absolute bottom-0 left-0 top-0 cursor-w-resize bg-white/12 transition-colors hover:bg-white/20"
        style={{ width: '18px' }}
      />
      {/* コンテンツ */}
      <div className="flex-1 px-5 overflow-hidden">
        <span className="text-[10px] text-white font-medium whitespace-nowrap">
          {minsToTime(shift.startMins)}〜{minsToTime(shift.endMins)}
          {shift.position ? ` [${shift.position}]` : ''}
          {shift.isDirty ? ' •' : ''}
        </span>
      </div>
      {/* 右リサイズハンドル */}
      <div
        className="absolute bottom-0 right-0 top-0 cursor-e-resize bg-white/12 transition-colors hover:bg-white/20"
        style={{ width: '18px' }}
      />
    </div>
  )
}

// ── 編集ポップオーバー ─────────────────────────────────────────────────────────

const POPOVER_W = 256
const POPOVER_H = 330  // approximate height

function EditPopover({
  shift,
  anchorEl,
  onUpdate,
  onDelete,
  onClose,
}: {
  shift:     CShift
  anchorEl:  HTMLElement
  onUpdate:  (localId: string, patch: Partial<CShift>) => void
  onDelete:  (localId: string) => void
  onClose:   () => void
}) {
  const rect = anchorEl.getBoundingClientRect()

  // 下に十分スペースがあれば下、なければ上に表示（fixed なので scrollY 不要）
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const top = spaceBelow >= POPOVER_H
    ? rect.bottom + 8
    : Math.max(8, rect.top - POPOVER_H - 8)

  const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_W - 8))

  return (
    <div
      className="fixed z-50 rounded-lg border border-gray-200 bg-white p-4 text-gray-700 shadow-xl"
      style={{ top: `${top}px`, left: `${left}px`, width: `${POPOVER_W}px` }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-900">確定シフト編集</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {/* 開始時間 */}
        <div>
          <label className="mb-1 block text-xs text-[#8a8f98]">開始時間</label>
          <select
            value={minsToTime(shift.startMins)}
            onChange={e => onUpdate(shift.localId, { startMins: timeToMins(e.target.value) })}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 outline-none transition-colors focus:border-[#006633]"
          >
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 終了時間 */}
        <div>
          <label className="mb-1 block text-xs text-[#8a8f98]">終了時間</label>
          <select
            value={minsToTime(shift.endMins)}
            onChange={e => onUpdate(shift.localId, { endMins: timeToMins(e.target.value) })}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 outline-none transition-colors focus:border-[#006633]"
          >
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* ポジション */}
        <div>
          <label className="mb-1 block text-xs text-[#8a8f98]">ポジション</label>
          <select
            value={shift.position ?? ''}
            onChange={e => onUpdate(shift.localId, { position: e.target.value || null })}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 outline-none transition-colors focus:border-[#006633]"
          >
            <option value="">未設定</option>
            {POSITIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onDelete(shift.localId)}
            className="flex-1 rounded-md border border-red-400/40 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
          >
            削除
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-[#0a7a45] bg-[#006633] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#004d26]"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  )
}
