import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ルートページ — ロールに応じたダッシュボードへリダイレクト
export default async function RootPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log('[ROOT] user:', user.email, '/ role:', profile?.role)

  if (profile?.role === 'admin') {
    redirect('/admin/shifts')
  }

  redirect('/staff/shifts')
}
