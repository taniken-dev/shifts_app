import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function DashboardEntryPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_approved')
    .eq('id', user.id)
    .single()

  if (!profile?.is_approved) {
    redirect('/pending')
  }

  if (profile?.role === 'admin') {
    redirect('/admin/schedule')
  }

  redirect('/staff/shifts')
}
