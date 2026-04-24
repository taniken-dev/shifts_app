import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('line_oauth_state')?.value

  const errorUrl = new URL('/login', origin)
  errorUrl.searchParams.set('error', 'oauth_callback_failed')

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(errorUrl)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/api/auth/line/callback`,
      client_id: process.env.NEXT_PUBLIC_LINE_CHANNEL_ID!,
      client_secret: process.env.LINE_CHANNEL_SECRET!,
    }),
  })

  if (!tokenRes.ok) return NextResponse.redirect(errorUrl)

  const { access_token } = await tokenRes.json()

  // Get LINE user profile
  const profileRes = await fetch('https://api.line.me/oauth2/v2.1/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!profileRes.ok) return NextResponse.redirect(errorUrl)

  const { sub: lineId, name, picture } = await profileRes.json()
  const lineEmail = `line_${lineId}@line.user`
  const admin = createServiceRoleClient()

  // Find or create Supabase user
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingUser = userList?.users.find(u => u.email === lineEmail)

  if (existingUser) {
    await admin.auth.admin.updateUserById(existingUser.id, {
      user_metadata: {
        full_name: name,
        avatar_url: picture,
        provider: 'custom:line',
        line_user_id: lineId,
      },
    })
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: lineEmail,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        avatar_url: picture,
        provider: 'custom:line',
        line_user_id: lineId,
      },
    })
    if (error) return NextResponse.redirect(errorUrl)
  }

  // Generate magic link to create session (does not send email)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: lineEmail,
  })

  if (linkError || !linkData?.properties?.hashed_token) return NextResponse.redirect(errorUrl)

  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('token_hash', linkData.properties.hashed_token)
  callbackUrl.searchParams.set('type', 'magiclink')
  callbackUrl.searchParams.set('next', '/dashboard')

  const response = NextResponse.redirect(callbackUrl)
  response.cookies.delete('line_oauth_state')
  return response
}
