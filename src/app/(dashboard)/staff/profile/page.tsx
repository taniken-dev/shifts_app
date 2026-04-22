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
    .select('full_name, staff_code, is_deletion_requested')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/staff/shifts')
  }

  const provider = typeof user.app_metadata?.provider === 'string'
    ? user.app_metadata.provider
    : ''

  return (
    <UserProfileEditor
      fullName={profile.full_name}
      staffCode={profile.staff_code}
      email={user.email ?? '未設定'}
      isLineLogin={provider.startsWith('custom:line')}
      isDeletionRequested={profile.is_deletion_requested}
    />
  )
}
