'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, ToggleLeft, ToggleRight, Pencil, X, UserCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { staffSchema, type StaffInput } from '@/lib/validations/shift'
import type { Profile } from '@/types/database'
import { Toast } from '@/components/ui/Toast'

const SKILL_OPTIONS = ['レジ', 'セッター', 'カウンター', 'フライヤー', 'グリル', '仕込み', 'メンテ', '閉店作業'] as const

interface StaffListItem extends Pick<
  Profile,
  'id' | 'staff_code' | 'full_name' | 'role' | 'is_active' | 'is_approved' | 'is_deletion_requested' | 'skills' | 'created_at'
> {
  email: string
}

interface StaffManagerProps {
  staffList: StaffListItem[]
}

type FieldErrors = Partial<Record<keyof StaffInput, string>>

type EditTarget = {
  id:                    string
  full_name:             string
  staff_code:            string
  role:                  'staff' | 'admin'
  is_active:             boolean
  is_deletion_requested: boolean
  email:                 string
  new_password:          string
  confirm_password:      string
  skills:                string[]
}

export default function StaffManager({ staffList }: StaffManagerProps) {
  const router = useRouter()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<StaffInput>({
    email: '', full_name: '', staff_code: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPendingAccordionOpen, setIsPendingAccordionOpen] = useState(true)

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editErrors, setEditErrors] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function handleChange(key: keyof StaffInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddStaff(e: React.SyntheticEvent) {
    e.preventDefault()
    setFieldErrors({})

    const result = staffSchema.safeParse(form)
    if (!result.success) {
      const errs: FieldErrors = {}
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof StaffInput
        if (key) errs[key] = err.message
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
    setLoading(false)

    if (!res.ok) {
      setToastMsg(json.error ?? 'スタッフの追加に失敗しました')
      return
    }

    setForm({ email: '', full_name: '', staff_code: '' })
    setShowForm(false)
    setToastMsg('招待メールを送信しました')
    router.refresh()
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    setTogglingId(id)
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !currentActive }),
    })
    const json = await res.json()
    setTogglingId(null)

    if (!res.ok) {
      setToastMsg(json.error ?? '有効状態の更新に失敗しました')
      return
    }

    setToastMsg('有効状態を更新しました')
    router.refresh()
  }

  async function handleApproveStaff(id: string, fullName: string) {
    const confirmed = window.confirm(`${fullName} を承認しますか？`)
    if (!confirmed) return

    setApprovingId(id)
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_approved: true }),
    })
    const json = await res.json()
    setApprovingId(null)

    if (!res.ok) {
      setToastMsg(json.error ?? '承認に失敗しました')
      return
    }

    setToastMsg(`${fullName} を承認しました`)
    router.refresh()
  }

  async function handleDeleteAccount(target: StaffListItem) {
    const confirmed = window.confirm(
      `${target.full_name} のアカウントを完全削除します。取り消しできません。実行しますか？`,
    )
    if (!confirmed) return

    setDeletingId(target.id)
    const res = await fetch('/api/admin/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id }),
    })
    const json = await res.json()
    setDeletingId(null)

    if (!res.ok) {
      setToastMsg(json.error ?? 'アカウント削除に失敗しました')
      return
    }

    setToastMsg(`${target.full_name} のアカウントを削除しました`)
    router.refresh()
  }

  function openEdit(staff: StaffListItem) {
    setEditTarget({
      id: staff.id,
      full_name: staff.full_name,
      staff_code: staff.staff_code,
      role: staff.role,
      is_active: staff.is_active,
      is_deletion_requested: staff.is_deletion_requested,
      email: staff.email,
      new_password: '',
      confirm_password: '',
      skills: staff.skills ?? [],
    })
    setEditErrors(null)
  }

  function closeEdit() {
    setEditTarget(null)
    setEditErrors(null)
  }

  function toggleSkill(skill: string) {
    setEditTarget((prev) => {
      if (!prev) return prev
      const hasSkill = prev.skills.includes(skill)
      return {
        ...prev,
        skills: hasSkill ? prev.skills.filter((v) => v !== skill) : [...prev.skills, skill],
      }
    })
  }

  async function handleEditSave() {
    if (!editTarget) return
    setEditErrors(null)

    if (!editTarget.full_name.trim()) {
      setEditErrors('氏名を入力してください')
      return
    }
    if (!editTarget.staff_code.trim()) {
      setEditErrors('スタッフコードを入力してください')
      return
    }
    if (!editTarget.email.trim()) {
      setEditErrors('メールアドレスを入力してください')
      return
    }
    if (editTarget.new_password && editTarget.new_password !== editTarget.confirm_password) {
      setEditErrors('新しいパスワードが一致しません')
      return
    }

    if (editTarget.new_password) {
      const confirmed = window.confirm('パスワードを変更します。よろしいですか？')
      if (!confirmed) return
    }

    setEditLoading(true)
    const res = await fetch('/api/admin/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editTarget.id,
        full_name: editTarget.full_name,
        staff_code: editTarget.staff_code,
        role: editTarget.role,
        is_active: editTarget.is_active,
        is_deletion_requested: editTarget.is_deletion_requested,
        email: editTarget.email,
        new_password: editTarget.new_password,
        skills: editTarget.skills,
      }),
    })
    const json = await res.json()
    setEditLoading(false)

    if (!res.ok) {
      setEditErrors(json.error ?? '更新に失敗しました')
      setToastMsg(json.error ?? '更新に失敗しました')
      return
    }

    closeEdit()
    setToastMsg('スタッフ情報を更新しました')
    router.refresh()
  }

  const pendingStaffList = staffList.filter((staff) => staff.role === 'staff' && !staff.is_approved)

  return (
    <div className="space-y-4">
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        <UserPlus className="h-4 w-4" aria-hidden />
        スタッフを招待
      </button>

      {showForm && (
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-gray-800">スタッフ招待</h2>
          <form onSubmit={handleAddStaff} noValidate className="space-y-4">
            {[
              { id: 'full_name', label: '氏名', type: 'text', placeholder: '山田 太郎' },
              { id: 'staff_code', label: 'スタッフコード', type: 'text', placeholder: 'S001' },
              { id: 'email', label: 'メールアドレス', type: 'email', placeholder: 'yamada@example.com' },
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
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              招待メール内のリンクから、スタッフ本人が安全にパスワードを設定します。
            </p>

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '招待メールを送信'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                }}
                className="btn-secondary"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <button
          type="button"
          onClick={() => setIsPendingAccordionOpen((prev) => !prev)}
          aria-expanded={isPendingAccordionOpen}
          className="mb-4 flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50"
        >
          <div>
            <h2 className="text-base font-semibold text-gray-800">承認待ちスタッフ</h2>
            <p className="mt-1 text-xs text-gray-500">LINEログイン済みで未承認のユーザーです。</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge-submitted">{pendingStaffList.length} 件</span>
            {isPendingAccordionOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden />
            )}
          </div>
        </button>

        {isPendingAccordionOpen && (
          pendingStaffList.length === 0 ? (
            <p className="text-sm text-gray-500">現在、承認待ちのユーザーはいません。</p>
          ) : (
            <div className="space-y-2">
              {pendingStaffList.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{staff.full_name}</p>
                    <p className="text-xs text-gray-500">{staff.staff_code} / {staff.email || 'メール未設定'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApproveStaff(staff.id, staff.full_name)}
                    disabled={approvingId === staff.id}
                    className="btn-primary"
                  >
                    {approvingId === staff.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" aria-hidden />
                        承認する
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">コード</th>
              <th className="px-4 py-3">氏名</th>
              <th className="px-4 py-3">メール</th>
              <th className="px-4 py-3">権限</th>
              <th className="px-4 py-3 text-center">承認</th>
              <th className="px-4 py-3 text-center">有効</th>
              <th className="px-4 py-3 text-center">削除</th>
              <th className="px-4 py-3 text-center">編集</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffList.map((staff) => (
              <tr
                key={staff.id}
                className={`hover:bg-gray-50 transition-colors ${!staff.is_active ? 'opacity-50' : ''} ${staff.is_deletion_requested ? 'bg-red-50/70' : ''}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{staff.staff_code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    {staff.full_name}
                    {staff.is_deletion_requested && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">退会申請</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{staff.email || '未設定'}</td>
                <td className="px-4 py-3">
                  <span className={staff.role === 'admin' ? 'badge-approved' : 'badge-submitted'}>
                    {staff.role === 'admin' ? '管理者' : 'スタッフ'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={staff.is_approved ? 'badge-approved' : 'badge-submitted'}>
                    {staff.is_approved ? '承認済み' : '未承認'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(staff.id, staff.is_active)}
                    disabled={togglingId === staff.id || staff.role === 'admin'}
                    className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    aria-label={staff.is_active ? '無効化する' : '有効化する'}
                  >
                    {togglingId === staff.id
                      ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      : staff.is_active
                        ? <ToggleRight className="h-5 w-5 text-green-500" aria-hidden />
                        : <ToggleLeft className="h-5 w-5" aria-hidden />
                    }
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  {staff.is_deletion_requested ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(staff)}
                      disabled={deletingId === staff.id}
                      className="inline-flex items-center justify-center rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:bg-red-300"
                    >
                      {deletingId === staff.id ? '削除中...' : '完全削除'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openEdit(staff)}
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
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">氏名</label>
                <input
                  type="text"
                  value={editTarget.full_name}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, full_name: e.target.value } : t)}
                  className="input-field"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">スタッフコード</label>
                <input
                  type="text"
                  value={editTarget.staff_code}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, staff_code: e.target.value } : t)}
                  className="input-field font-mono"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">メールアドレス（管理者が直接変更可能）</label>
                <input
                  type="email"
                  value={editTarget.email}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, email: e.target.value } : t)}
                  className="input-field"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">新しいパスワード（任意）</label>
                <input
                  type="password"
                  value={editTarget.new_password}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, new_password: e.target.value } : t)}
                  className="input-field"
                  placeholder="変更しない場合は空欄"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">新しいパスワード（確認）</label>
                <input
                  type="password"
                  value={editTarget.confirm_password}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, confirm_password: e.target.value } : t)}
                  className="input-field"
                  placeholder="確認用"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">権限</label>
                <select
                  value={editTarget.role}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, role: e.target.value as 'staff' | 'admin' } : t)}
                  className="input-field"
                  disabled={editLoading}
                >
                  <option value="staff">スタッフ</option>
                  <option value="admin">管理者</option>
                </select>
              </div>

              <div>
                <label className="label">習熟スキル（複数選択）</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3">
                  {SKILL_OPTIONS.map((skill) => {
                    const checked = editTarget.skills.includes(skill)
                    return (
                      <label key={skill} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSkill(skill)}
                          disabled={editLoading}
                        />
                        <span>{skill}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f9fafb', borderRadius: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>アカウント有効</span>
                <button
                  type="button"
                  onClick={() => setEditTarget((t) => t ? { ...t, is_active: !t.is_active } : t)}
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

            {editErrors && (
              <p role="alert" style={{ fontSize: '13px', fontWeight: 600, color: '#d6231e', background: '#fef2f2', borderRadius: '10px', padding: '10px 14px', margin: 0 }}>
                {editErrors}
              </p>
            )}

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
