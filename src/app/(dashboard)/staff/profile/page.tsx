import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import UserProfileEditor from '@/components/staff/UserProfileEditor'

export const metadata: Metadata = { title: 'プロフィール' }

export default async function StaffProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, staff_code, is_deletion_requested, is_demo')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/staff/shifts')
  }

  const provider = typeof user.app_metadata?.provider === 'string'
    ? user.app_metadata.provider
    : ''
  const isLineLogin =
    provider.startsWith('custom:line') ||
    typeof user.user_metadata?.line_user_id === 'string'

  return (
    <UserProfileEditor
      fullName={profile.full_name}
      staffCode={profile.staff_code}
      email={user.email ?? '未設定'}
      isLineLogin={isLineLogin}
      isDeletionRequested={profile.is_deletion_requested}
      isDemo={profile.is_demo ?? false}
    />
  )
}
