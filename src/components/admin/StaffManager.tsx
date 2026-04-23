'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, ToggleLeft, ToggleRight, Pencil, X } from 'lucide-react'
import { staffSchema, type StaffInput } from '@/lib/validations/shift'
import type { Profile } from '@/types/database'
import { Toast } from '@/components/ui/Toast'

// 習熟度レベルの定義（管理者のみ閲覧）
const LEVEL_OPTIONS = [
  { value: 1, label: 'Lv.1　レジ' },
  { value: 2, label: 'Lv.2　ドリンク' },
  { value: 3, label: 'Lv.3　スルー' },
  { value: 4, label: 'Lv.4　カスタマー' },
  { value: 5, label: 'Lv.5　フライヤー' },
  { value: 6, label: 'Lv.6　セッター' },
] as const

interface StaffManagerProps {
  staffList: Pick<Profile, 'id' | 'staff_code' | 'full_name' | 'role' | 'is_active' | 'level' | 'created_at'>[]
}

type FieldErrors = Partial<Record<keyof StaffInput, string>>

type EditTarget = {
  id:         string
  full_name:  string
  staff_code: string
  role:       'staff' | 'admin'
  is_active:  boolean
  level:      number | null
}

export default function StaffManager({ staffList }: StaffManagerProps) {
  const router = useRouter()

  // ── 追加フォーム状態 ─────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<StaffInput>({
    email: '', full_name: '', staff_code: '', password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)

  // ── 有効/無効トグル ──────────────────────────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── 編集モーダル状態 ─────────────────────────────────────────────────────
  const [editTarget, setEditTarget]   = useState<EditTarget | null>(null)
  const [editErrors, setEditErrors]   = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // ── 追加フォーム ─────────────────────────────────────────────────────────
  function handleChange(key: keyof StaffInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddStaff(e: React.SyntheticEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const result = staffSchema.safeParse(form)
    if (!result.success) {
      const errs: FieldErrors = {}
      result.error.errors.forEach((e) => {
        const key = e.path[0] as keyof StaffInput
        if (key) errs[key] = e.message
      })
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.data),
    })

    const json = await res.json()
    if (!res.ok) {
      setServerError(json.error ?? 'スタッフの追加に失敗しました')
      setLoading(false)
      return
    }

    setForm({ email: '', full_name: '', staff_code: '', password: '' })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  // ── 有効/無効トグル ──────────────────────────────────────────────────────
  async function handleToggleActive(id: string, currentActive: boolean) {
    setTogglingId(id)
    await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !currentActive }),
    })
    setTogglingId(null)
    router.refresh()
  }

  // ── 編集モーダル ─────────────────────────────────────────────────────────
  function openEdit(s: Pick<Profile, 'id' | 'staff_code' | 'full_name' | 'role' | 'is_active' | 'level' | 'created_at'>) {
    setEditTarget({
      id: s.id, full_name: s.full_name, staff_code: s.staff_code,
      role: s.role, is_active: s.is_active, level: s.level ?? null,
    })
    setEditErrors(null)
  }

  function closeEdit() {
    setEditTarget(null)
    setEditErrors(null)
  }

  async function handleEditSave() {
    if (!editTarget) return
    setEditErrors(null)
    if (!editTarget.full_name.trim()) { setEditErrors('氏名を入力してください'); return }
    if (!editTarget.staff_code.trim()) { setEditErrors('スタッフコードを入力してください'); return }

    setEditLoading(true)
    const res = await fetch('/api/admin/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editTarget),
    })
    const json = await res.json()
    setEditLoading(false)

    if (!res.ok) {
      setEditErrors(json.error ?? '更新に失敗しました')
      return
    }

    closeEdit()
    setToastMsg(`${editTarget.full_name} の情報を更新しました`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

      {/* スタッフ追加ボタン */}
      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        <UserPlus className="h-4 w-4" aria-hidden />
        スタッフを追加
      </button>

      {/* 追加フォーム */}
      {showForm && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">新規スタッフ追加</h2>
          <form onSubmit={handleAddStaff} noValidate className="space-y-4">
            {[
              { id: 'full_name',   label: '氏名',           type: 'text',     placeholder: '山田 太郎' },
              { id: 'staff_code',  label: 'スタッフコード', type: 'text',     placeholder: 'S001' },
              { id: 'email',       label: 'メールアドレス', type: 'email',    placeholder: 'yamada@example.com' },
              { id: 'password',    label: '初期パスワード', type: 'password', placeholder: '8文字以上・大文字・数字含む' },
            ].map(({ id, label, type, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} className="label">{label} <span className="text-red-500">*</span></label>
                <input
                  id={id}
                  type={type}
                  value={form[id as keyof StaffInput]}
                  onChange={(e) => handleChange(id as keyof StaffInput, e.target.value)}
                  className={`input-field ${fieldErrors[id as keyof StaffInput] ? 'input-error' : ''}`}
                  placeholder={placeholder}
                  disabled={loading}
                />
                {fieldErrors[id as keyof StaffInput] && (
                  <p className="error-message">{fieldErrors[id as keyof StaffInput]}</p>
                )}
              </div>
            ))}

            {serverError && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                {serverError}
              </p>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '追加する'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* スタッフ一覧 */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">コード</th>
              <th className="px-4 py-3">氏名</th>
              <th className="px-4 py-3">権限</th>
              <th className="px-4 py-3 text-center">有効</th>
              <th className="px-4 py-3 text-center">編集</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffList.map((s) => (
              <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.staff_code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                <td className="px-4 py-3">
                  <span className={s.role === 'admin' ? 'badge-approved' : 'badge-submitted'}>
                    {s.role === 'admin' ? '管理者' : 'スタッフ'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(s.id, s.is_active)}
                    disabled={togglingId === s.id || s.role === 'admin'}
                    className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    aria-label={s.is_active ? '無効化する' : '有効化する'}
                  >
                    {togglingId === s.id
                      ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      : s.is_active
                        ? <ToggleRight className="h-5 w-5 text-green-500" aria-hidden />
                        : <ToggleLeft className="h-5 w-5" aria-hidden />
                    }
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openEdit(s)}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="編集する"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {editTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.40)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEdit() }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '400px',
              padding: '28px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>
                スタッフ情報の編集
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="閉じる"
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '9999px',
                  width: '32px', height: '32px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#6b7280',
                }}
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* フォームフィールド */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 氏名 */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  氏名
                </label>
                <input
                  type="text"
                  value={editTarget.full_name}
                  onChange={(e) => setEditTarget(t => t ? { ...t, full_name: e.target.value } : t)}
                  className="input-field"
                  disabled={editLoading}
                />
              </div>

              {/* スタッフコード */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  スタッフコード
                </label>
                <input
                  type="text"
                  value={editTarget.staff_code}
                  onChange={(e) => setEditTarget(t => t ? { ...t, staff_code: e.target.value } : t)}
                  className="input-field font-mono"
                  disabled={editLoading}
                />
              </div>

              {/* 権限 */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  権限
                </label>
                <select
                  value={editTarget.role}
                  onChange={(e) => setEditTarget(t => t ? { ...t, role: e.target.value as 'staff' | 'admin' } : t)}
                  className="input-field"
                  disabled={editLoading}
                >
                  <option value="staff">スタッフ</option>
                  <option value="admin">管理者</option>
                </select>
              </div>

              {/* 習熟度レベル（管理者のみ閲覧） */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  習熟度レベル
                  <span style={{ marginLeft: '6px', fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>管理者のみ閲覧</span>
                </label>
                <select
                  value={editTarget.level ?? ''}
                  onChange={(e) => setEditTarget(t => t ? { ...t, level: e.target.value ? Number(e.target.value) : null } : t)}
                  className="input-field"
                  disabled={editLoading}
                >
                  <option value="">未設定</option>
                  {LEVEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 有効フラグ */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f9fafb', borderRadius: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>アカウント有効</span>
                <button
                  type="button"
                  onClick={() => setEditTarget(t => t ? { ...t, is_active: !t.is_active } : t)}
                  disabled={editLoading}
                  aria-label={editTarget.is_active ? '無効化する' : '有効化する'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {editTarget.is_active
                    ? <ToggleRight style={{ width: 32, height: 32, color: '#22c55e' }} aria-hidden />
                    : <ToggleLeft style={{ width: 32, height: 32, color: '#9ca3af' }} aria-hidden />
                  }
                </button>
              </div>
            </div>

            {/* エラー */}
            {editErrors && (
              <p role="alert" style={{ fontSize: '13px', fontWeight: 600, color: '#d6231e', background: '#fef2f2', borderRadius: '10px', padding: '10px 14px', margin: 0 }}>
                {editErrors}
              </p>
            )}

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={editLoading}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '保存する'}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                disabled={editLoading}
                className="btn-secondary"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
