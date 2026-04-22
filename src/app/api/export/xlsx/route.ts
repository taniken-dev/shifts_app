import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generatePeriodWorkScheduleXlsx, generateWorkScheduleXlsx, type Period } from '@/lib/utils/workschedule'

/**
 * GET /api/export/xlsx?date=YYYY-MM-DD
 * GET /api/export/xlsx?month=YYYY-MM&period=first|second
 *
 * - date 指定: その日付1シートのみの xlsx を返す
 * - month + period 指定: 半月ぶんを1ファイル（日付別シート）で返す
 * 管理者専用エンドポイント。
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  // 認証 + 管理者確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, is_approved').eq('id', user.id).single()

  if (profile?.role !== 'admin' || !profile.is_approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ---- パラメータ検証 ----
  const sp     = request.nextUrl.searchParams
  const date   = sp.get('date')    // "YYYY-MM-DD"
  const month  = sp.get('month')   // "YYYY-MM"
  const period = sp.get('period')  // "first" | "second"

  // ---- Service Role でデータ取得 ----
  const db = createServiceRoleClient()

  // ---- 1日単位エクスポート ----
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
    }

    const [{ data: staff, error: staffErr }, { data: shifts, error: shiftsErr }] =
      await Promise.all([
        db.from('profiles')
          .select('id, staff_code, full_name')
          .eq('is_active', true)
          .eq('role', 'staff')
          .order('staff_code', { ascending: true }),

        db.from('shifts')
          .select('profile_id, shift_date, start_time, end_time, status')
          .eq('shift_date', date),
      ])

    if (staffErr)  { console.error('xlsx(day) staff error:',  staffErr.message)  }
    if (shiftsErr) { console.error('xlsx(day) shifts error:', shiftsErr.message) }

    const normalizedShifts = (shifts ?? []).map((s) => ({
      ...s,
      shift_date: s.shift_date.slice(0, 10),
      start_time: s.start_time.slice(0, 5),
      end_time:   s.end_time.slice(0, 5),
    }))

    const buffer = await generateWorkScheduleXlsx(
      date,
      staff ?? [],
      normalizedShifts,
    )
    const filename = `workschedule_${date}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control':       'no-store',
      },
    })
  }

  // ---- 半月エクスポート ----
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

  const lastDay = new Date(year, monthNum, 0).getDate()
  const [fromDay, toDay] = period === 'first' ? [1, 15] : [16, lastDay]
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${month}-${pad(fromDay)}`
  const to   = `${month}-${pad(toDay)}`

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

  if (staffErr)  { console.error('xlsx(period) staff error:',  staffErr.message)  }
  if (shiftsErr) { console.error('xlsx(period) shifts error:', shiftsErr.message) }

  const normalizedShifts = (shifts ?? []).map((s) => ({
    ...s,
    shift_date: s.shift_date.slice(0, 10),
    start_time: s.start_time.slice(0, 5),
    end_time:   s.end_time.slice(0, 5),
  }))

  const buffer = await generatePeriodWorkScheduleXlsx(
    month,
    period as Period,
    staff ?? [],
    normalizedShifts,
  )

  const periodLabel = period === 'first' ? '前半' : '後半'
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
