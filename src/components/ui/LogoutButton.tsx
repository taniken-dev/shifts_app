'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      aria-label="ログアウト"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '6px 13px 6px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        border: '1.5px solid #cbd5e1',
        whiteSpace: 'nowrap',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.backgroundColor = '#fde8e7'
        el.style.color = '#b91c1c'
        el.style.borderColor = '#fca5a5'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.backgroundColor = '#f1f5f9'
        el.style.color = '#64748b'
        el.style.borderColor = '#cbd5e1'
      }}
    >
      <LogOut size={13} aria-hidden />
      <span>ログアウト</span>
    </button>
  )
}
