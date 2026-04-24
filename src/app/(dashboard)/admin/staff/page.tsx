import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import StaffManager from '@/components/admin/StaffManager'

export const metadata: Metadata = { title: 'スタッフ管理 (管理者)' }

type AuthUserForSync = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function resolvePendingUserName(user: AuthUserForSync) {
  const fullName = user.user_metadata?.full_name
  if (typeof fullName === 'string' && fullName.trim().length > 0) return fullName

  const name = user.user_metadata?.name
  if (typeof name === 'string' && name.trim().length > 0) return name

  const displayName = user.user_metadata?.display_name
  if (typeof displayName === 'string' && displayName.trim().length > 0) return displayName

  return user.email ?? '未設定'
}

export default async function AdminStaffPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_demo')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/staff/shifts')

  const isDemo = profile?.is_demo ?? false

  const admin = createServiceRoleClient()
  const [{ data: initialStaffList, error }, usersResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, staff_code, full_name, role, is_active, is_approved, is_deletion_requested, skills, created_at')
      .eq('is_demo', isDemo)
      .order('staff_code', { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (error) console.error('staff fetch error:', error.message)
  if (usersResult.error) console.error('auth users fetch error:', usersResult.error.message)

  let staffList = initialStaffList ?? []
  const authUsers = (usersResult.data?.users ?? []) as AuthUserForSync[]
  const existingProfileIds = new Set(staffList.map((staff) => staff.id))
  const missingProfileUsers = authUsers.filter((authUser) => !existingProfileIds.has(authUser.id))

  if (missingProfileUsers.length > 0) {
    const { error: backfillError } = await admin
      .from('profiles')
      .insert(
        missingProfileUsers.map((authUser) => ({
          id: authUser.id,
          staff_code: `PENDING-${authUser.id.slice(0, 8)}`,
          full_name: resolvePendingUserName(authUser),
          role: 'staff' as const,
          is_active: true,
          is_approved: false,
        })),
      )

    if (backfillError) {
      console.error('missing profile backfill error:', backfillError.message)
    } else {
      const { data: refreshedStaffList, error: refreshError } = await admin
        .from('profiles')
        .select('id, staff_code, full_name, role, is_active, is_approved, is_deletion_requested, skills, created_at')
        .order('staff_code', { ascending: true })
      if (refreshError) {
        console.error('staff refetch error:', refreshError.message)
      } else {
        staffList = refreshedStaffList ?? []
      }
    }
  }

  const emailMap = new Map(
    authUsers.map((u) => [u.id, u.email ?? '']),
  )

  const enrichedStaffList = staffList.map((staff) => ({
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
