import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * サーバーサイド（Server Component / Route Handler / Server Action）用クライアント。
 * Cookie を通じてセッションを読み書きする。
 * 呼び出しごとに新しいインスタンスを生成する（Next.js の非同期コンテキスト境界のため）。
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component 内では set が不可のケースがある（読み取り専用）
            // Middleware でリフレッシュするため、ここでは無視してよい
          }
        },
      },
    },
  )
}

/**
 * Service Role クライアント（管理者操作専用）。
 * RLS をバイパスするため、Route Handler のサーバーサイドのみで使用すること。
 * クライアントサイドに公開しないよう厳守する。
 */
export function createServiceRoleClient() {
  // Service Role キーは NEXT_PUBLIC_ でない環境変数から取得
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  // @supabase/ssr は SSR 向けのため、純粋な supabase-js を使用
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
