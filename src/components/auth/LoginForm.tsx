'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)

  useEffect(() => {
    const authError = searchParams.get('error')
    if (authError === 'oauth_callback_failed') {
      setError('LINEログインに失敗しました。もう一度お試しください。')
    }
    if (authError === 'profile_sync_failed') {
      setError('アカウント情報の同期に失敗しました。時間をおいて再度お試しください。')
    }
    if (authError === 'email_link_failed') {
      setError('メールリンクの認証に失敗しました。再度お試しください。')
    }
  }, [searchParams])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  async function handleLineLogin() {
    setError(null)
    setLineLoading(true)

    const supabase = createClient()
    const redirectTo = new URL('/auth/callback', window.location.origin)
    redirectTo.searchParams.set('next', '/dashboard')

    const { error: authError } = await supabase.auth.signInWithOAuth({
      // auth-js の OAuth provider 型が custom:* を含まないため、実行時サポートに合わせて指定する
      provider: 'custom:line' as never,
      options: {
        redirectTo: redirectTo.toString(),
      },
    })

    if (authError) {
      setError('LINEログインを開始できませんでした。時間をおいて再度お試しください。')
      setLineLoading(false)
    }
  }

  const isFormDisabled = loading || lineLoading
  const isSubmitDisabled =
    isFormDisabled ||
    !email ||
    !password

  return (
    /* card-elevated: rounded-xl, p-8, 柔らかい影 */
    <div className="card-elevated">

      {/* カードヘッダー */}
      <div className="mb-8">
        <h2
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--gray-900)' }}
        >
          アカウントにサインイン
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
          LINEログインが最短です。招待済みスタッフはメールアドレスでもログインできます。
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={handleLineLogin}
          disabled={isFormDisabled}
          aria-label="LINEでログイン"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            height: '56px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: isFormDisabled ? '#9ddfb1' : '#06C755',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 800,
            letterSpacing: '-0.01em',
            cursor: isFormDisabled ? 'not-allowed' : 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          {lineLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              LINEでログイン中...
            </>
          ) : (
            <>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#06C755',
                  fontSize: '11px',
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                LINE
              </span>
              LINEでログイン
            </>
          )}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--gray-100)' }} />
        <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>または</span>
        <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--gray-100)' }} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* メールアドレス */}
        <div>
          <label htmlFor="email" className="label">メールアドレス</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Mail className="h-[17px] w-[17px]" style={{ color: 'var(--gray-400)' }} aria-hidden />
            </span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field pl-10"
              placeholder="you@example.com"
              disabled={isFormDisabled}
            />
          </div>
        </div>

        {/* パスワード */}
        <div>
          <label htmlFor="password" className="label">パスワード</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Lock className="h-[17px] w-[17px]" style={{ color: 'var(--gray-400)' }} aria-hidden />
            </span>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pl-10"
              placeholder="••••••••"
              disabled={isFormDisabled}
            />
          </div>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div role="alert" className="alert-error">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {/* ログインボタン — w-full, py-3 相当 */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              width: '100%',
              paddingTop: '14px',
              paddingBottom: '14px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              backgroundColor: isSubmitDisabled ? '#e5e7eb' : '#374151',
              color: isSubmitDisabled ? '#9ca3af' : '#ffffff',
              border: 'none',
              letterSpacing: '-0.01em',
              transition: 'all 150ms ease',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                サインイン中...
              </>
            ) : (
              'サインイン'
            )}
          </button>
        </div>

      </form>

      {/* フッター区切り */}
      <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--gray-100)' }}>
        <p className="text-center text-xs" style={{ color: 'var(--gray-400)' }}>
          LINEログイン・メールログインのどちらでも、同一の Supabase ユーザーID を基準にプロフィール管理されます
        </p>
      </div>
    </div>
  )
}
