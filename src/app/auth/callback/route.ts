import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const admin = createServiceRoleClient()
  const defaultName =
    typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.length > 0
      ? user.user_metadata.full_name
      : (user.email ?? '未設定')

  await admin.from('profiles').upsert(
    {
      id: user.id,
      staff_code: `PENDING-${user.id.slice(0, 8)}`,
      full_name: defaultName,
      role: 'staff',
      is_active: true,
      is_approved: false,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = await createServerSupabaseClient()

  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const destination = next.startsWith('/') ? next : '/dashboard'

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      const loginUrl = new URL('/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'oauth_callback_failed')
      return NextResponse.redirect(loginUrl)
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })

    if (error) {
      const loginUrl = new URL('/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'email_link_failed')
      return NextResponse.redirect(loginUrl)
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await ensureProfile(user)
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin))
}
