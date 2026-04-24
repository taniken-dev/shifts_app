import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const state = crypto.randomBytes(16).toString('hex')
  const origin = new URL(request.url).origin

  const lineUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  lineUrl.searchParams.set('response_type', 'code')
  lineUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_LINE_CHANNEL_ID!)
  lineUrl.searchParams.set('redirect_uri', `${origin}/api/auth/line/callback`)
  lineUrl.searchParams.set('state', state)
  lineUrl.searchParams.set('scope', 'openid profile')

  const response = NextResponse.redirect(lineUrl.toString())
  response.cookies.set('line_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
