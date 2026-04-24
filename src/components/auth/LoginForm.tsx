'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, Lock, Loader2, AlertCircle, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const DEMO_ACCOUNTS = {
  admin: {
    email:    process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL    ?? '',
    password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? '',
    label:    '店長として体験',
  },
  staff: {
    email:    process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL    ?? '',
    password: process.env.NEXT_PUBLIC_DEMO_STAFF_PASSWORD ?? '',
    label:    'スタッフとして体験',
  },
} as const

export default function LoginForm() {
  const searchParams = useSearchParams()
  const isDemoMode   = searchParams.get('view') === 'demo'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState<'admin' | 'staff' | null>(null)

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

  async function handleDemoLogin(role: 'admin' | 'staff') {
    setError(null)
    setDemoLoading(role)

    const { email: demoEmail, password: demoPass } = DEMO_ACCOUNTS[role]
    if (!demoEmail || !demoPass) {
      setError('デモアカウントが設定されていません。')
      setDemoLoading(null)
      return
    }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    demoEmail,
      password: demoPass,
    })

    if (authError) {
      setError('デモログインに失敗しました。しばらくしてから再度お試しください。')
      setDemoLoading(null)
      return
    }

    window.location.href = '/dashboard'
  }

  const isFormDisabled = loading || lineLoading || demoLoading !== null
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
          {isDemoMode ? 'デモ体験ログイン' : 'アカウントにサインイン'}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
          {isDemoMode
            ? 'ポートフォリオ閲覧用のサンプルアカウントでログインできます。'
            : 'LINEログインが最短です。招待済みスタッフはメールアドレスでもログインできます。'}
        </p>
      </div>

      {/* ── 通常ログイン（デモモード時は非表示） ── */}
      {!isDemoMode && (
        <>
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

            {/* ログインボタン */}
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
        </>
      )}

      {/* ── デモログイン（?view=demo の時のみ表示） ── */}
      {isDemoMode && (
        <div
          style={{
            borderRadius: '14px',
            border: '1.5px dashed #bbf7d0',
            backgroundColor: '#f0fdf4',
            padding: '20px 18px 18px',
          }}
        >
          {error && (
            <div role="alert" className="alert-error" style={{ marginBottom: '12px' }}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
            <FlaskConical
              aria-hidden
              style={{ width: '15px', height: '15px', color: '#16a34a', flexShrink: 0 }}
            />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', letterSpacing: '-0.01em' }}>
              デモ体験ログイン
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '10px',
                fontWeight: 700,
                color: '#16a34a',
                backgroundColor: '#bbf7d0',
                borderRadius: '999px',
                padding: '2px 8px',
                letterSpacing: '0.03em',
              }}
            >
              DEMO
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '14px', lineHeight: 1.6 }}>
            ポートフォリオ閲覧用のサンプルアカウントです。
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            {(['staff', 'admin'] as const).map(role => {
              const isThis = demoLoading === role
              const isOther = demoLoading !== null && !isThis
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDemoLogin(role)}
                  disabled={isFormDisabled}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    paddingTop: '11px',
                    paddingBottom: '11px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    border: '1.5px solid',
                    cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                    transition: 'all 150ms ease',
                    borderColor: isOther ? '#d1fae5' : '#22c55e',
                    backgroundColor: isOther
                      ? '#f0fdf4'
                      : isThis
                      ? '#16a34a'
                      : '#22c55e',
                    color: isOther ? '#86efac' : '#ffffff',
                  }}
                >
                  {isThis ? (
                    <>
                      <Loader2 style={{ width: '13px', height: '13px' }} className="animate-spin" aria-hidden />
                      ログイン中...
                    </>
                  ) : (
                    DEMO_ACCOUNTS[role].label
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
