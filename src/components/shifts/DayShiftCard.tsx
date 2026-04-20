'use client'

// ── 定数 ────────────────────────────────────────────────────────────────────

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const

const TIME_SLOTS: string[] = []
for (let h = 9; h <= 21; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 21) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

const PRESETS = [
  { id: 'a', label: '11:00〜17:00', start: '11:00', end: '17:00', isOpenStart: false, isOpenEnd: false },
  { id: 'b', label: '11:00〜15:00', start: '11:00', end: '15:00', isOpenStart: false, isOpenEnd: false },
  { id: 'c', label: '〇〜17:00',    start: '09:00', end: '17:00', isOpenStart: true,  isOpenEnd: false },
  { id: 'd', label: '〇〜15:00',    start: '09:00', end: '15:00', isOpenStart: true,  isOpenEnd: false },
  { id: 'e', label: '17:00〜〇',    start: '17:00', end: '22:00', isOpenStart: false, isOpenEnd: true  },
  { id: 'f', label: '◎',           start: '09:00', end: '22:00', isOpenStart: true,  isOpenEnd: true  },
]

// ── 型 ──────────────────────────────────────────────────────────────────────

export type DayEntry = {
  date:        string
  isOff:       boolean | null   // null = 未選択
  startTime:   string           // is_open_start=true のとき '09:00' で保存
  endTime:     string           // is_open_end=true のとき '22:00' で保存
  isOpenStart: boolean          // true = 開始フリー（何時からでも可）。UI では「〇」表示
  isOpenEnd:   boolean          // true = メンテ（閉店作業）まで。UI では「〇」表示
}

// ── ユーティリティ ───────────────────────────────────────────────────────────

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

// ── スタイル定数 ─────────────────────────────────────────────────────────────


const TOGGLE_OFF_STYLE: React.CSSProperties = {   // 「休みにする」ボタン
  flexShrink: 0,
  borderRadius: '9999px',
  padding: '10px 16px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  backgroundColor: '#f1f5f9',
  color: '#475569',
  border: '1.5px solid #94a3b8',
  transition: 'all 200ms ease',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '44px',
}

const TOGGLE_ON_STYLE: React.CSSProperties = {    // 「+ 出勤できる」ボタン
  flexShrink: 0,
  borderRadius: '9999px',
  padding: '10px 16px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  backgroundColor: '#e5f2eb',
  color: '#006633',
  border: '1.5px solid rgba(0,102,51,0.35)',
  transition: 'all 200ms ease',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '44px',
}

const SELECT_STYLE_BASE: React.CSSProperties = {
  width: '108px',
  appearance: 'none' as const,
  borderRadius: '10px',
  padding: '10px 28px 10px 10px',
  fontSize: '16px',   // 16px 未満だと iOS が自動ズームするため
  fontWeight: 600,
  backgroundColor: '#fff',
  cursor: 'pointer',
  outline: 'none',
  minHeight: '44px',
}

// ── コンポーネント ────────────────────────────────────────────────────────────

interface Props {
  entry:    DayEntry
  onChange: (updated: DayEntry) => void
}

export default function DayShiftCard({ entry, onChange }: Props) {
  const date    = new Date(entry.date + 'T00:00:00')
  const dow     = date.getDay()
  const dayNum  = date.getDate()
  const dayName = DAY_NAMES[dow]
  const isSun   = dow === 0
  const isSat   = dow === 6

  const isUnset      = entry.isOff === null
  const hasError     = entry.isOff === false && !entry.isOpenEnd && !entry.isOpenStart && entry.startTime >= entry.endTime
  const duration     = entry.isOff === false && !hasError && !entry.isOpenEnd && !entry.isOpenStart ? durationLabel(entry.startTime, entry.endTime) : ''
  const activePreset = PRESETS.find(p =>
    p.isOpenStart === entry.isOpenStart &&
    p.isOpenEnd   === entry.isOpenEnd   &&
    (entry.isOpenStart ? true : p.start === entry.startTime) &&
    (entry.isOpenEnd   ? true : p.end   === entry.endTime)
  )

  const set = (patch: Partial<DayEntry>) => onChange({ ...entry, ...patch })

  // ── 日付カラー ───────────────────────────────────────────────────────────
  const dateNumColor = isUnset ? '#9ca3af'
    : entry.isOff ? '#d1d5db'
    : isSun ? '#d6231e'
    : isSat ? '#3b82f6'
    : '#111827'

  const dayBadgeBg    = isUnset ? '#f3f4f6' : entry.isOff ? '#f3f4f6' : isSun ? '#fef2f2' : isSat ? '#eff6ff' : '#f3f4f6'
  const dayBadgeColor = isUnset ? '#9ca3af'  : entry.isOff ? '#d1d5db' : isSun ? '#f87171' : isSat ? '#60a5fa' : '#6b7280'

  // ── カードスタイル ─────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = isUnset
    ? {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        backgroundColor: '#fafafa',
        border: '1.5px dashed #e5e7eb',
        padding: '14px 16px',
      }
    : entry.isOff
    ? {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        backgroundColor: '#f9fafb',
        border: '1px solid #f1f5f9',
        padding: '14px 16px',
      }
    : {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        backgroundColor: '#ffffff',
        border: hasError ? '1px solid #fca5a5' : '1px solid #f1f5f9',
        padding: '14px 16px 14px 20px',
        boxShadow: hasError
          ? '0 1px 3px rgba(214,35,30,0.08), 0 4px 16px rgba(214,35,30,0.05)'
          : '0 1px 2px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)',
      }

  return (
    <div style={cardStyle}>

      {/* 左アクセントバー（出勤日のみ） */}
      {entry.isOff === false && (
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 0,
          width: '3px',
          borderRadius: '16px 0 0 16px',
          backgroundColor: hasError ? '#d6231e' : '#006633',
        }} />
      )}

      {/* ── 行1: 日付 + ボタン群 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>

        {/* 日付エリア */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{
            fontSize: '26px', fontWeight: 900, lineHeight: 1,
            letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
            color: dateNumColor,
          }}>
            {dayNum}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700,
              padding: '2px 6px', borderRadius: '5px',
              backgroundColor: dayBadgeBg, color: dayBadgeColor,
            }}>
              {dayName}
            </span>
            {isUnset && (
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af' }}>未選択</span>
            )}
            {entry.isOff === false && !hasError && (
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#006633', fontVariantNumeric: 'tabular-nums' }}>
                {entry.isOpenStart && entry.isOpenEnd
                  ? '◎'
                  : `${entry.isOpenStart ? '〇' : entry.startTime}〜${entry.isOpenEnd ? '〇' : entry.endTime}`}
                {duration && <span style={{ marginLeft: '4px', opacity: 0.5 }}>({duration})</span>}
              </span>
            )}
            {hasError && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#d6231e' }}>時間が不正</span>
            )}
          </div>
        </div>

        {/* ── ボタン群 ── */}
        {isUnset ? (
          // 未選択状態: 出勤 / 休み 2択ボタン
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => set({ isOff: false, startTime: '11:00', endTime: '17:00', isOpenStart: false, isOpenEnd: false })}
              style={TOGGLE_ON_STYLE}
            >
              + 出勤できる
            </button>
            <button
              type="button"
              onClick={() => set({ isOff: true })}
              style={TOGGLE_OFF_STYLE}
            >
              休み
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => set({ isOff: entry.isOff ? false : true })}
            style={entry.isOff ? TOGGLE_ON_STYLE : TOGGLE_OFF_STYLE}
          >
            {entry.isOff ? '+ 出勤できる' : '休みにする'}
          </button>
        )}
      </div>

      {/* ── 出勤設定エリア ── */}
      {entry.isOff === false && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* プリセットチップ（LY Corp: 角張りタグ） */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PRESETS.map(p => {
              const isActive = p.id === activePreset?.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ isOff: false, startTime: p.start, endTime: p.end, isOpenStart: p.isOpenStart, isOpenEnd: p.isOpenEnd })}
                  className={isActive ? 'chip-square chip-square-active' : 'chip-square chip-square-idle'}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* 時間セレクト — 1行インライン */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', flexShrink: 0 }}>
              開始
            </span>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                value={entry.isOpenStart ? '__OPEN_START__' : entry.startTime}
                onChange={e => {
                  if (e.target.value === '__OPEN_START__') {
                    set({ isOpenStart: true, startTime: '09:00' })
                  } else {
                    set({ isOpenStart: false, startTime: e.target.value })
                  }
                }}
                style={{
                  ...SELECT_STYLE_BASE,
                  border: hasError ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
                  color: hasError ? '#d6231e' : entry.isOpenStart ? '#006633' : '#111827',
                }}
              >
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__OPEN_START__">〇 フリー</option>
              </select>
              <span style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', fontSize: '10px', color: '#94a3b8',
              }}>▾</span>
            </div>

            <span style={{ color: '#cbd5e1', fontSize: '14px', flexShrink: 0, userSelect: 'none' }}>—</span>

            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', flexShrink: 0 }}>
              終了
            </span>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                value={entry.isOpenEnd ? '__OPEN__' : entry.endTime}
                onChange={e => {
                  if (e.target.value === '__OPEN__') {
                    set({ isOpenEnd: true, endTime: '22:00' })
                  } else {
                    set({ isOpenEnd: false, endTime: e.target.value })
                  }
                }}
                style={{
                  ...SELECT_STYLE_BASE,
                  border: hasError ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
                  color: hasError ? '#d6231e' : entry.isOpenEnd ? '#006633' : '#111827',
                }}
              >
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__OPEN__">〇 メンテ</option>
              </select>
              <span style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', fontSize: '10px', color: '#94a3b8',
              }}>▾</span>
            </div>

            {duration && !hasError && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#006633', fontVariantNumeric: 'tabular-nums', marginLeft: '2px' }}>
                {duration}
              </span>
            )}
          </div>

          {/* バリデーションエラー */}
          {hasError && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#d6231e', margin: 0 }} role="alert">
              <span aria-hidden>⚠</span>
              開始時間は終了時間より前に設定してください
            </p>
          )}
        </div>
      )}
    </div>
  )
}
