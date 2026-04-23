import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import DailyWorkScheduleEditor from '@/components/admin/DailyWorkScheduleEditor'
import WorkScheduleExportButton from '@/components/admin/WorkScheduleExportButton'

export const metadata: Metadata = { title: 'ワークスケジュール (管理者)' }
export const dynamic = 'force-dynamic'

type HalfPeriod = 'first' | 'second'

type AvailablePeriod = {
  year: number
  month: number
  period: HalfPeriod
}

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

  if (!targetDate) {
    // 提出済みシフト（status='submitted'）から、
    // 年/月/前半後半のユニーク組み合わせを作る。
    const { data: submittedRows, error: submittedError } = await db
      .from('shifts')
      .select('shift_date')
      .eq('status', 'submitted')

    if (submittedError) {
      return (
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-red-800">ワークスケジュール</h1>
          <p className="mt-2 text-sm text-red-700">期間データの取得に失敗しました。</p>
        </div>
      )
    }

    const periodMap = new Map<string, AvailablePeriod>()

    for (const row of submittedRows ?? []) {
      const shiftDate = row.shift_date.slice(0, 10)
      const [yearStr, monthStr, dayStr] = shiftDate.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr)
      const day = Number(dayStr)
      if (!year || !month || !day) continue

      const period: HalfPeriod = day <= 15 ? 'first' : 'second'
      const key = `${year}-${String(month).padStart(2, '0')}-${period}`
      if (!periodMap.has(key)) {
        periodMap.set(key, { year, month, period })
      }
    }

    const availablePeriods = Array.from(periodMap.values()).sort((a, b) => {
      const byYear = b.year - a.year
      if (byYear !== 0) return byYear
      const byMonth = b.month - a.month
      if (byMonth !== 0) return byMonth
      const aRank = a.period === 'second' ? 2 : 1
      const bRank = b.period === 'second' ? 2 : 1
      return bRank - aRank
    })

    return (
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">ワークスケジュール</h1>
        <p className="mt-1 text-sm text-gray-500">
          表示したい期間を選択してください
        </p>

        {availablePeriods.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">データが見つかりません</p>
            <p className="mt-1 text-xs text-gray-500">提出済みシフトの登録後に表示されます。</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {availablePeriods.map((periodInfo) => {
              const monthBase = `${periodInfo.year}-${String(periodInfo.month).padStart(2, '0')}`
              const monthLabel = `${periodInfo.year}年${periodInfo.month}月`
              const isFirst = periodInfo.period === 'first'
              const startDate = `${monthBase}-${isFirst ? '01' : '16'}`
              const lastDay = new Date(periodInfo.year, periodInfo.month, 0).getDate()
              const dateLabel = isFirst ? '1日〜15日' : `16日〜${lastDay}日`
              const periodLabel = isFirst ? '前半' : '後半'

              return (
                <div
                  key={`${monthBase}-${periodInfo.period}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-6 transition-colors hover:border-[#006633] hover:bg-[#e5f2eb]"
                >
                  <div className="text-sm font-semibold text-[#006633]">{monthLabel}{periodLabel}</div>
                  <div className="mt-1 text-sm text-gray-600">{dateLabel}</div>
                  <div className="mt-3 text-xs text-gray-500">開始日: {startDate}</div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/schedule?date=${startDate}`}
                      className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[#006633] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#004d26]"
                    >
                      この期間を表示
                    </Link>
                    <WorkScheduleExportButton month={monthBase} period={periodInfo.period} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
