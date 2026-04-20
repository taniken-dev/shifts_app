'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ShiftWithProfile } from '@/types/database'

interface ShiftTableProps {
  shifts: ShiftWithProfile[]
}

const STATUS_BADGE: Record<string, string> = {
  submitted: 'badge-submitted',
  approved:  'badge-approved',
  rejected:  'badge-rejected',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: '提出済',
  approved:  '承認済',
  rejected:  '却下',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export default function ShiftTable({ shifts }: ShiftTableProps) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setUpdatingId(id)
    const supabase = createClient()
    await supabase.from('shifts').update({ status }).eq('id', id)
    setUpdatingId(null)
    router.refresh()
  }

  if (shifts.length === 0) {
    return (
      <p className="card text-center text-sm text-gray-400 py-10">
        この月のシフト希望はありません
      </p>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">日付</th>
              <th className="px-4 py-3">スタッフ</th>
              <th className="px-4 py-3">時間</th>
              <th className="px-4 py-3">備考</th>
              <th className="px-4 py-3">状態</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shifts.map((shift) => {
              const isUpdating = updatingId === shift.id
              const canUpdate  = shift.status === 'submitted'

              return (
                <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {formatDate(shift.shift_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{shift.profiles.full_name}</p>
                    <p className="text-xs text-gray-400">{shift.profiles.staff_code}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--mos-green)' }}>
                    {shift.is_open_start && shift.is_open_end
                      ? '◎'
                      : `${shift.is_open_start ? '〇' : shift.start_time.slice(0,5)}〜${shift.is_open_end ? '〇' : shift.end_time.slice(0,5)}`}
                  </td>
                  <td className="px-4 py-3 max-w-[120px] truncate text-gray-500">
                    {shift.note ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={STATUS_BADGE[shift.status]}>
                      {STATUS_LABELS[shift.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isUpdating ? (
                      <div className="flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />
                      </div>
                    ) : canUpdate ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateStatus(shift.id, 'approved')}
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                          aria-label="承認"
                          title="承認"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          onClick={() => updateStatus(shift.id, 'rejected')}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="却下"
                          title="却下"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className="block text-center text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
