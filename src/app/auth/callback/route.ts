import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const destination = next.startsWith('/') ? next : '/dashboard'
  const destinationUrl = new URL(destination, requestUrl.origin)

  let response = NextResponse.redirect(destinationUrl)
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

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

  return response
}
