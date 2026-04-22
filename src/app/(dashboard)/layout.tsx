import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import NavBar from '@/components/ui/NavBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_approved')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.is_approved) redirect('/pending')

  return (
    // flex を一切使わない — ブロックレイアウト で確実に中央配置
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F5F7' }}>
      <NavBar fullName={profile.full_name} role={profile.role} />
      {/*
        ▼ ここが唯一の「センターコンテナ」
          max-width: 672px  +  margin: 0 auto  で
          デスクトップは左右に大きな余白、モバイルはフルWidthになる
      */}
      <main
        style={{
          maxWidth: profile.role === 'admin' ? '1400px' : '42rem',
          margin: '0 auto',
          padding: profile.role === 'admin' ? '2rem 2rem' : '2rem 1rem',
        }}
      >
        {children}
      </main>
    </div>
  )
}
