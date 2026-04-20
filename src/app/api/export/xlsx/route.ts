import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generatePeriodWorkScheduleXlsx, type Period } from '@/lib/utils/workschedule'

/**
 * GET /api/export/xlsx?month=YYYY-MM&period=first|second
 *
 * 指定月の前半（1〜15日）または後半（16〜末日）の
 * 確定シフトをまとめた1ファイル・日付別シート構成の xlsx を返す。
 * 管理者専用エンドポイント。
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  // 認証 + 管理者確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ---- パラメータ検証 ----
  const sp     = request.nextUrl.searchParams
  const month  = sp.get('month')   // "YYYY-MM"
  const period = sp.get('period')  // "first" | "second"

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month は YYYY-MM 形式で指定してください' }, { status: 400 })
  }
  if (period !== 'first' && period !== 'second') {
    return NextResponse.json({ error: 'period は "first" または "second" を指定してください' }, { status: 400 })
  }

  const [year, monthNum] = month.split('-').map(Number)
  if (monthNum < 1 || monthNum > 12) {
    return NextResponse.json({ error: '無効な月です' }, { status: 400 })
  }

  // ---- 日付範囲の計算 ----
  const lastDay = new Date(year, monthNum, 0).getDate()
  const [fromDay, toDay] = period === 'first' ? [1, 15] : [16, lastDay]
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${month}-${pad(fromDay)}`
  const to   = `${month}-${pad(toDay)}`

  // ---- Service Role でデータ取得 ----
  const db = createServiceRoleClient()

  const [{ data: staff, error: staffErr }, { data: shifts, error: shiftsErr }] =
    await Promise.all([
      db.from('profiles')
        .select('id, staff_code, full_name')
        .eq('is_active', true)
        .eq('role', 'staff')
        .order('staff_code', { ascending: true }),

      db.from('shifts')
        .select('profile_id, shift_date, start_time, end_time, status')
        .gte('shift_date', from)
        .lte('shift_date', to),
    ])

  if (staffErr)  { console.error('xlsx staff error:',  staffErr.message)  }
  if (shiftsErr) { console.error('xlsx shifts error:', shiftsErr.message) }

  // 時間文字列を "HH:MM" に正規化
  const normalizedShifts = (shifts ?? []).map((s) => ({
    ...s,
    shift_date: s.shift_date.slice(0, 10),
    start_time: s.start_time.slice(0, 5),
    end_time:   s.end_time.slice(0, 5),
  }))

  // ---- xlsx 生成 ----
  const buffer = await generatePeriodWorkScheduleXlsx(
    month,
    period as Period,
    staff ?? [],
    normalizedShifts,
  )

  const periodLabel = period === 'first' ? '前半' : '後半'
  const [, m] = month.split('-')
  const filename = `workschedule_${month}_${periodLabel}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control':       'no-store',
    },
  })
}
