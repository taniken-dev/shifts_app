import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
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

  const admin = createServiceRoleClient()
  const [{ data: staffList, error }, usersResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, staff_code, full_name, role, is_active, is_approved, is_deletion_requested, skills, created_at')
      .order('staff_code', { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (error) console.error('staff fetch error:', error.message)
  if (usersResult.error) console.error('auth users fetch error:', usersResult.error.message)

  const emailMap = new Map(
    (usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? '']),
  )

  const enrichedStaffList = (staffList ?? []).map((staff) => ({
    ...staff,
    email: emailMap.get(staff.id) ?? '',
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">スタッフ管理</h1>
        <p className="mt-1 text-sm text-gray-500">承認・退会申請・スキル・認証情報を管理できます。</p>
      </div>
      <StaffManager staffList={enrichedStaffList} />
    </div>
  )
}
