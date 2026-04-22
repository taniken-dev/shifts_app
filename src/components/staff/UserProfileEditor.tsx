'use client'

import { useState } from 'react'
import { Mail, Lock, CircleAlert } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'

interface UserProfileEditorProps {
  fullName: string
  staffCode: string
  email: string
  isLineLogin: boolean
  isDeletionRequested: boolean
}

export default function UserProfileEditor({
  fullName,
  staffCode,
  email,
  isLineLogin,
  isDeletionRequested,
}: UserProfileEditorProps) {
  const [pending, setPending] = useState(isDeletionRequested)
  const [loading, setLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  async function handleRequestDeletion() {
    const confirmed = window.confirm('退会を申請しますか？管理者がアカウント削除を行うまで利用停止はされません。')
    if (!confirmed) return

    setLoading(true)
    const res = await fetch('/api/staff/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request_deletion' }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setToastMsg(json.error ?? '退会申請に失敗しました')
      return
    }

    setPending(true)
    setToastMsg('退会申請を受け付けました。管理者による削除をお待ちください。')
  }

  return (
    <div className="space-y-5">
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

      <div className="card space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">プロフィール</h1>
          <p className="mt-1 text-sm text-gray-500">アカウント情報の確認と退会申請ができます。</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">氏名</label>
            <input className="input-field" value={fullName} disabled readOnly />
          </div>
          <div>
            <label className="label">スタッフコード</label>
            <input className="input-field font-mono" value={staffCode} disabled readOnly />
          </div>
          <div>
            <label className="label">メールアドレス（読み取り専用）</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-[17px] w-[17px]" style={{ color: 'var(--gray-400)' }} aria-hidden />
              </span>
              <input className="input-field pl-10" value={email} disabled readOnly />
            </div>
          </div>
          {!isLineLogin && (
            <div>
              <label className="label">パスワード（読み取り専用）</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-[17px] w-[17px]" style={{ color: 'var(--gray-400)' }} aria-hidden />
                </span>
                <input className="input-field pl-10" value="********" disabled readOnly />
              </div>
            </div>
          )}
          {isLineLogin && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              LINEログインのため、パスワード項目は表示されません。
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-amber-700">
          <CircleAlert className="h-5 w-5" aria-hidden />
          <h2 className="text-base font-semibold">退会申請</h2>
        </div>

        {pending ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            申請済み。管理者によるアカウント削除をお待ちください。
          </p>
        ) : (
          <button
            type="button"
            onClick={handleRequestDeletion}
            disabled={loading}
            className="btn-secondary"
            style={{ color: '#b91c1c', borderColor: '#fecaca', backgroundColor: '#fff1f2' }}
          >
            {loading ? '申請中...' : '退会を申請する'}
          </button>
        )}
      </div>
    </div>
  )
}
