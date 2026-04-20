import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, CalendarDays } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ShiftPeriodForm from '@/components/shifts/ShiftPeriodForm'

export const metadata: Metadata = { title: 'シフト希望' }

export default async function StaffShiftsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 提出済み件数だけ取得（一覧は別ページ）
  const today = new Date()
  const threeMonthsLater = new Date(today)
  threeMonthsLater.setMonth(today.getMonth() + 3)

  const { count } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .gte('shift_date', today.toISOString().split('T')[0])
    .lte('shift_date', threeMonthsLater.toISOString().split('T')[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ページヘッダー */}
      <div>
        <h1 style={{
          fontSize: '26px',
          fontWeight: 900,
          color: '#111827',
          letterSpacing: '-0.03em',
          margin: 0,
        }}>
          シフト希望
        </h1>
        <p style={{ marginTop: '4px', fontSize: '13px', color: '#9ca3af' }}>
          期間を選び、各日の希望をまとめて提出できます。
        </p>
      </div>

      <ShiftPeriodForm />

      {/* 提出済みシフトへのリンク */}
      <Link
        href="/staff/shifts/history"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderRadius: '16px',
          backgroundColor: '#ffffff',
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          textDecoration: 'none',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#f3f4f6',
            flexShrink: 0,
          }}>
            <CalendarDays size={18} style={{ color: '#374151' }} />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>提出済みシフトを確認</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
              {count != null && count > 0 ? `今後3ヶ月で ${count} 件提出済み` : '今後3ヶ月の提出はありません'}
            </p>
          </div>
        </div>
        <ChevronRight size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
      </Link>

    </div>
  )
}
