import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import PendingScreen from '@/components/auth/PendingScreen'

export default async function PendingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_approved) {
    redirect('/dashboard')
  }

  return <PendingScreen />
}
