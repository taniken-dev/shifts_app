import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SubmittedShiftsCalendar from '@/components/shifts/SubmittedShiftsCalendar'

export const metadata: Metadata = { title: '提出済みシフト' }

export default async function ShiftHistoryPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const threeMonthsLater = new Date(today)
  threeMonthsLater.setMonth(today.getMonth() + 3)

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('profile_id', user.id)
    .gte('shift_date', today.toISOString().split('T')[0])
    .lte('shift_date', threeMonthsLater.toISOString().split('T')[0])
    .order('shift_date', { ascending: true })

  if (error) console.error('shifts fetch error:', error.message)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ページヘッダー */}
      <div>
        <Link
          href="/staff/shifts"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#6b7280',
            textDecoration: 'none',
            marginBottom: '12px',
          }}
        >
          <ChevronLeft size={14} />
          シフト希望に戻る
        </Link>
        <h1 style={{
          fontSize: '26px',
          fontWeight: 900,
          color: '#111827',
          letterSpacing: '-0.03em',
          margin: 0,
        }}>
          提出済みシフト
        </h1>
        <p style={{ marginTop: '4px', fontSize: '13px', color: '#9ca3af' }}>
          今後3ヶ月の提出済みシフト希望一覧
        </p>
      </div>

      <SubmittedShiftsCalendar shifts={shifts ?? []} />

    </div>
  )
}
