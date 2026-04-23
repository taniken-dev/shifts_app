import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Edge Middleware でセッションを自動リフレッシュするためのユーティリティ。
 * src/middleware.ts から呼び出す。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() を呼ぶことでセッション有効期限を自動延長する
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 未認証ユーザーをログインページへリダイレクト
  const isAuthRoute = pathname.startsWith('/login')
  const isPendingRoute = pathname.startsWith('/pending')
  const isDashboard =
    pathname.startsWith('/staff') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard')

  if (!user && isDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) {
    return supabaseResponse
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_approved, role')
    .eq('id', user.id)
    .maybeSingle()

  const isApproved = profile?.is_approved === true

  if (!isApproved && isDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/pending'
    return NextResponse.redirect(url)
  }

  if (isApproved && isPendingRoute) {
    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'admin' ? '/admin/shifts' : '/staff/shifts'
    return NextResponse.redirect(url)
  }

  // 認証済みユーザーがログインページに来たらロールに応じた画面へ
  if (isAuthRoute) {
    const url = request.nextUrl.clone()
    if (!isApproved) {
      url.pathname = '/pending'
    } else {
      url.pathname = profile?.role === 'admin' ? '/admin/shifts' : '/staff/shifts'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
