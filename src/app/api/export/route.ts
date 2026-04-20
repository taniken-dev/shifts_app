import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftsToCSV } from '@/lib/utils/csv'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  // 認証 + 管理者ロール確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // month パラメータの検証
  const month = request.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM.' }, { status: 400 })
  }

  const [year, monthNum] = month.split('-').map(Number)
  if (monthNum < 1 || monthNum > 12) {
    return NextResponse.json({ error: 'Invalid month value.' }, { status: 400 })
  }

  const from = `${month}-01`
  const lastDay = new Date(year, monthNum, 0).getDate()
  const to = `${month}-${String(lastDay).padStart(2, '0')}`

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select(`
      *,
      profiles ( staff_code, full_name )
    `)
    .gte('shift_date', from)
    .lte('shift_date', to)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('export query error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const csv = shiftsToCSV((shifts ?? []) as import('@/types/database').ShiftWithProfile[])

  const filename = `shifts_${month}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // キャッシュ禁止（個人情報を含むため）
      'Cache-Control': 'no-store',
    },
  })
}
