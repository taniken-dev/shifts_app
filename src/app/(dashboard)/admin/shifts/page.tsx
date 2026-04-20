import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import ShiftMatrix from '@/components/admin/ShiftMatrix'

export const metadata: Metadata = { title: 'シフト管理 (管理者)' }
// キャッシュを無効化して常に最新データを取得する
export const dynamic = 'force-dynamic'

type Period = 'first' | 'second'

function lastDayOf(year: number, month: number) { return new Date(year, month, 0).getDate() }

function periodRange(period: Period, year: number, month: number): [number, number] {
  return period === 'first' ? [1, 15] : [16, lastDayOf(year, month)]
}

export default async function AdminShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; period?: string }>
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

  console.log('[ADMIN SHIFTS] user:', user.email, '/ role:', profile?.role)
  if (profile?.role !== 'admin') redirect('/staff/shifts')

  // URL パラメータ解析
  const params  = await searchParams
  const month   = params.month ?? new Date().toISOString().slice(0, 7)
  const defaultPeriod: Period = new Date().getDate() > 15 ? 'second' : 'first'
  const period  = (params.period === 'second' ? 'second' : params.period === 'first' ? 'first' : defaultPeriod) as Period

  const [year, monthNum] = month.split('-').map(Number)
  const [s, e] = periodRange(period, year, monthNum)
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${month}-${pad(s)}`
  const to   = `${month}-${pad(e)}`

  // データ取得は Service Role で RLS をバイパス（サーバーサイド専用）
  let db: ReturnType<typeof createServiceRoleClient>
  try {
    db = createServiceRoleClient()
  } catch (e) {
    console.error('[ADMIN SHIFTS] createServiceRoleClient failed — SUPABASE_SERVICE_ROLE_KEY missing?', e)
    return <div style={{ padding: '40px', color: 'red' }}>
      サーバー設定エラー: SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local を確認してください。
    </div>
  }

  // アクティブなスタッフ全員取得（管理者除外）
  const { data: staff, error: staffError } = await db
    .from('profiles')
    .select('id, staff_code, full_name')
    .eq('is_active', true)
    .eq('role', 'staff')
    .order('staff_code', { ascending: true })

  if (staffError) console.error('[ADMIN SHIFTS] staff fetch error:', staffError.message)

  // 対象期間のシフト全件取得（全ステータス）
  const { data: shifts, error: shiftsError } = await db
    .from('shifts')
    .select(`
      *,
      profiles ( staff_code, full_name )
    `)
    .gte('shift_date', from)
    .lte('shift_date', to)
    .order('shift_date', { ascending: true })

  if (shiftsError) console.error('[ADMIN SHIFTS] shifts fetch error:', shiftsError.message)

  console.log(`[ADMIN SHIFTS] range=${from}〜${to} / staff=${staff?.length ?? 0} / shifts=${shifts?.length ?? 0}`)

  // shift_date の実際のフォーマットと profile_id の突合を診断
  if (shifts && shifts.length > 0) {
    console.log('[ADMIN SHIFTS] shift_date sample (raw):', shifts[0].shift_date, typeof shifts[0].shift_date)
    console.log('[ADMIN SHIFTS] start_time sample (raw):', shifts[0].start_time)
    console.dir(shifts, { depth: null })
  } else {
    console.log('[ADMIN SHIFTS] no shifts returned — from:', from, ' to:', to)
  }

  if (staff && shifts) {
    const staffIds = new Set(staff.map(s => s.id))
    const mismatched = shifts.filter(sh => !staffIds.has(sh.profile_id))
    if (mismatched.length > 0) {
      console.warn('[ADMIN SHIFTS] profile_id mismatch — these shifts have no matching staff:', mismatched.map(s => s.profile_id))
    } else {
      console.log('[ADMIN SHIFTS] profile_id check OK — all shifts match a staff record')
    }
  }

  // 日付リスト生成
  const dates: string[] = Array.from({ length: e - s + 1 }, (_, i) =>
    `${month}-${pad(s + i)}`
  )

  // shift_date が "YYYY-MM-DDT..." 形式で返る場合に "YYYY-MM-DD" へ正規化
  const normalizedShifts = (shifts ?? []).map(sh => ({
    ...sh,
    shift_date: sh.shift_date.slice(0, 10),
    start_time: sh.start_time.slice(0, 5),
    end_time:   sh.end_time.slice(0, 5),
  }))

  return (
    <ShiftMatrix
      staff={staff ?? []}
      shifts={normalizedShifts}
      dates={dates}
      month={month}
      period={period}
    />
  )
}
