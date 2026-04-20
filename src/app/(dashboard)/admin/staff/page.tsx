import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import StaffManager from '@/components/admin/StaffManager'

export const metadata: Metadata = { title: 'スタッフ管理 (管理者)' }

export default async function AdminStaffPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/staff/shifts')

  const { data: staffList, error } = await supabase
    .from('profiles')
    .select('id, staff_code, full_name, role, is_active, level, created_at')
    .order('staff_code', { ascending: true })

  if (error) console.error('staff fetch error:', error.message)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">スタッフ管理</h1>
        <p className="mt-1 text-sm text-gray-500">スタッフの追加・有効/無効の切り替えができます。</p>
      </div>
      <StaffManager staffList={staffList ?? []} />
    </div>
  )
}
