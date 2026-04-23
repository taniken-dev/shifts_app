import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type AuthUserLike = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

function resolveProfileName(user: AuthUserLike) {
  const fullName = user.user_metadata?.full_name
  if (typeof fullName === 'string' && fullName.trim().length > 0) return fullName

  const name = user.user_metadata?.name
  if (typeof name === 'string' && name.trim().length > 0) return name

  const displayName = user.user_metadata?.display_name
  if (typeof displayName === 'string' && displayName.trim().length > 0) return displayName

  return user.email ?? '未設定'
}

async function ensureProfile(user: AuthUserLike) {
  const admin = createServiceRoleClient()
  const defaultName = resolveProfileName(user)

  const { data: existingProfile, error: fetchError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) return { ok: false as const, error: fetchError.message }
  if (existingProfile) return { ok: true as const }

  const { error: insertError } = await admin
    .from('profiles')
    .insert({
      id: user.id,
      staff_code: `PENDING-${user.id.slice(0, 8)}`,
      full_name: defaultName,
      role: 'staff',
      is_active: true,
      is_approved: false,
    })

  if (insertError) return { ok: false as const, error: insertError.message }

  return { ok: true as const }
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
            request.cookies.set(name, value)
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
  if (!user) {
    const loginUrl = new URL('/login', requestUrl.origin)
    loginUrl.searchParams.set('error', 'oauth_callback_failed')
    return NextResponse.redirect(loginUrl)
  }

  const ensured = await ensureProfile(user)
  if (!ensured.ok) {
    const loginUrl = new URL('/login', requestUrl.origin)
    loginUrl.searchParams.set('error', 'profile_sync_failed')
    return NextResponse.redirect(loginUrl)
  }

  if (!response.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'))) {
    const loginUrl = new URL('/login', requestUrl.origin)
    loginUrl.searchParams.set('error', 'oauth_callback_failed')
    return NextResponse.redirect(loginUrl)
  }

  return response
}
