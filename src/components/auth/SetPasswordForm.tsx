'use client'

import { useState } from 'react'
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('パスワードの設定に失敗しました。もう一度お試しください。')
      return
    }

    setDone(true)
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 2000)
  }

  const isDisabled = loading || done

  return (
    <div className="card-elevated">
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--gray-900)' }}>
          パスワードを設定
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
          今後のログインに使用するパスワードを設定してください。
        </p>
      </div>

      {done ? (
        <div
          role="status"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '24px 0',
            color: '#166534',
          }}
        >
          <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
          <p className="text-sm font-medium">パスワードを設定しました。ダッシュボードへ移動します…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="password" className="label">新しいパスワード</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-[17px] w-[17px]" style={{ color: 'var(--gray-400)' }} aria-hidden />
              </span>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="8文字以上"
                disabled={isDisabled}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="label">パスワードの確認</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-[17px] w-[17px]" style={{ color: 'var(--gray-400)' }} aria-hidden />
              </span>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field pl-10"
                placeholder="もう一度入力"
                disabled={isDisabled}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="alert-error">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isDisabled || !password || !confirm}
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
                cursor: isDisabled || !password || !confirm ? 'not-allowed' : 'pointer',
                backgroundColor: isDisabled || !password || !confirm ? '#e5e7eb' : '#006633',
                color: isDisabled || !password || !confirm ? '#9ca3af' : '#ffffff',
                border: 'none',
                letterSpacing: '-0.01em',
                transition: 'all 150ms ease',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  設定中...
                </>
              ) : (
                'パスワードを設定する'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
