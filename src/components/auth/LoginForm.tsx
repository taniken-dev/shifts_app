'use client'

import { useState } from 'react'
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    // ロールを取得してリダイレクト先を決定
    const userId = authData.user?.id
    let destination = '/staff/shifts'

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      console.log('[LOGIN] user:', authData.user?.email, '/ role:', profile?.role)

      if (profile?.role === 'admin') {
        destination = '/admin/shifts'
      }
    }

    window.location.href = destination
  }

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
          登録されたメールアドレスとパスワードを入力してください
        </p>
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
              disabled={loading}
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
              disabled={loading}
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
            disabled={loading || !email || !password}
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
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              backgroundColor: loading || !email || !password ? '#e5e7eb' : '#374151',
              color: loading || !email || !password ? '#9ca3af' : '#ffffff',
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
          パスワードを忘れた場合は管理者にお問い合わせください
        </p>
      </div>
    </div>
  )
}