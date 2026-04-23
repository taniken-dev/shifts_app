import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import DailyWorkScheduleEditor from '@/components/admin/DailyWorkScheduleEditor'
import WorkScheduleExportButton from '@/components/admin/WorkScheduleExportButton'

export const metadata: Metadata = { title: 'ワークスケジュール (管理者)' }
export const dynamic = 'force-dynamic'

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createServerSupabaseClient()

  // 管理者ロール確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/staff/shifts')

  // 対象日（未指定時は半月選択画面を表示）
  const params     = await searchParams
  const targetDate = params.date

  if (!targetDate) {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const monthLabel = `${year}年${month}月`
    const monthBase = `${year}-${String(month).padStart(2, '0')}`
    const firstHalfStart = `${monthBase}-01`
    const secondHalfStart = `${monthBase}-16`
    const lastDay = new Date(year, month, 0).getDate()

    return (
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">ワークスケジュール</h1>
        <p className="mt-1 text-sm text-gray-500">
          表示したい期間を選択してください
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-6 transition-colors hover:border-[#006633] hover:bg-[#e5f2eb]">
            <div className="text-sm font-semibold text-[#006633]">{monthLabel}前半</div>
            <div className="mt-1 text-sm text-gray-600">1日〜15日</div>
            <div className="mt-3 text-xs text-gray-500">開始日: {firstHalfStart}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/schedule?date=${firstHalfStart}`}
                className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[#006633] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#004d26]"
              >
                この期間を表示
              </Link>
              <WorkScheduleExportButton month={monthBase} period="first" />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-6 transition-colors hover:border-[#006633] hover:bg-[#e5f2eb]">
            <div className="text-sm font-semibold text-[#006633]">{monthLabel}後半</div>
            <div className="mt-1 text-sm text-gray-600">16日〜{lastDay}日</div>
            <div className="mt-3 text-xs text-gray-500">開始日: {secondHalfStart}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/schedule?date=${secondHalfStart}`}
                className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[#006633] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#004d26]"
              >
                この期間を表示
              </Link>
              <WorkScheduleExportButton month={monthBase} period="second" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  let db: ReturnType<typeof createServiceRoleClient>
  try {
    db = createServiceRoleClient()
  } catch {
    return (
      <div style={{ padding: '40px', color: 'red' }}>
        サーバー設定エラー: SUPABASE_SERVICE_ROLE_KEY が未設定です。
      </div>
    )
  }

  // アクティブなスタッフ全員
  const { data: profiles } = await db
    .from('profiles')
    .select('id, staff_code, full_name')
    .eq('is_active', true)
    .eq('role', 'staff')
    .order('staff_code', { ascending: true })

  // 希望シフト（status = submitted）
  const { data: requested } = await db
    .from('shifts')
    .select('*, profiles(staff_code, full_name)')
    .eq('shift_date', targetDate)
    .eq('status', 'submitted')

  // 確定シフト（status = approved）
  const { data: confirmed } = await db
    .from('shifts')
    .select('*, profiles(staff_code, full_name)')
    .eq('shift_date', targetDate)
    .eq('status', 'approved')

  // 時刻を "HH:MM" に正規化
  const normalize = (shifts: typeof requested) =>
    (shifts ?? []).map(s => ({
      ...s,
      shift_date: s.shift_date.slice(0, 10),
      start_time: s.start_time.slice(0, 5),
      end_time:   s.end_time.slice(0, 5),
    }))

  return (
    <DailyWorkScheduleEditor
      date={targetDate}
      allProfiles={profiles ?? []}
      requestedShifts={normalize(requested)}
      confirmedShifts={normalize(confirmed)}
    />
  )
}
