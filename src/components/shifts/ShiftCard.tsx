'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Shift } from '@/types/database'

interface ShiftCardProps {
  shift: Shift
}

const STATUS_LABELS = {
  submitted: '提出済',
  approved:  '承認済',
  rejected:  '却下',
} as const

const STATUS_BADGE = {
  submitted: 'badge-submitted',
  approved:  'badge-approved',
  rejected:  'badge-rejected',
} as const

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

export default function ShiftCard({ shift }: ShiftCardProps) {
  const router  = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const canEdit = shift.status === 'submitted'

  async function handleDelete() {
    if (!confirm('このシフト希望を削除しますか？')) return
    setError(null)
    setDeleting(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', shift.id)

    if (error) {
      setError('削除に失敗しました')
      setDeleting(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="card card-lift flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {/* 日付 */}
        <p className="font-semibold text-gray-900 text-sm">
          {formatDate(shift.shift_date)}
        </p>
        {/* 時間 */}
        <p className="mt-0.5 text-base font-bold" style={{ color: 'var(--mos-green)' }}>
          {shift.is_open_start && shift.is_open_end
            ? '◎'
            : `${shift.is_open_start ? '〇' : shift.start_time.slice(0,5)} 〜 ${shift.is_open_end ? '〇' : shift.end_time.slice(0,5)}`}
        </p>
        {/* 備考 */}
        {shift.note && (
          <p className="mt-1 text-xs text-gray-500 truncate">{shift.note}</p>
        )}
        {/* エラー */}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      {/* ステータス + 削除ボタン */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={STATUS_BADGE[shift.status]}>
          {STATUS_LABELS[shift.status]}
        </span>
        {canEdit && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
            aria-label="シフトを削除"
          >
            {deleting
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              : <Trash2 className="h-4 w-4" aria-hidden />
            }
          </button>
        )}
      </div>
    </div>
  )
}
