'use client'

import { useState, type SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, Pencil, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { staffSchema, type StaffInput } from '@/lib/validations/shift'
import { BASE_SKILL_OPTIONS, LEAD_SKILL_OPTION, SKILL_OPTIONS } from '@/lib/constants/skills'
import type { Profile } from '@/types/database'
import { Toast } from '@/components/ui/Toast'

type ManagedStaff = Pick<
  Profile,
  'id' | 'staff_code' | 'full_name' | 'role' | 'is_active' | 'is_approved' | 'is_deletion_requested' | 'skills' | 'created_at'
> & { email: string }

interface StaffManagerProps {
  staffList: ManagedStaff[]
}

type FieldErrors = Partial<Record<keyof StaffInput, string>>

type EditTarget = {
  id: string
  full_name: string
  staff_code: string
  role: 'staff' | 'admin'
  is_active: boolean
  is_approved: boolean
  is_deletion_requested: boolean
  skills: string[]
  email: string
  new_password: string
}

function normalizeSkills(skills: string[]) {
  return skills.filter((skill): skill is (typeof SKILL_OPTIONS)[number] =>
    SKILL_OPTIONS.includes(skill as (typeof SKILL_OPTIONS)[number]),
  )
}

function expandSkillsForLeader(skills: (typeof SKILL_OPTIONS)[number][]) {
  if (skills.includes(LEAD_SKILL_OPTION)) {
    return [...BASE_SKILL_OPTIONS, LEAD_SKILL_OPTION]
  }
  return skills
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => { if (!disabled) onChange(!checked) }}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: '36px',
        height: '20px',
        borderRadius: '9999px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#16a34a' : '#d1d5db',
        transition: 'background 0.15s',
        padding: '2px',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '16px',
          height: '16px',
          borderRadius: '9999px',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 0.15s',
        }}
      />
    </button>
  )
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const json = await res.json()
    return typeof json.error === 'string' ? json.error : fallback
  } catch {
    return fallback
  }
}

export default function StaffManager({ staffList }: StaffManagerProps) {
  const router = useRouter()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<StaffInput>({
    email: '',
    full_name: '',
    staff_code: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editErrors, setEditErrors] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [unapprovedOpen, setUnapprovedOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false)

  const unapprovedStaff = staffList.filter((s) => !s.is_approved)
  const allSelected = unapprovedStaff.length > 0 && unapprovedStaff.every((s) => selectedIds.has(s.id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unapprovedStaff.map((s) => s.id)))
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`選択した ${selectedIds.size} 名を承認しますか？`)) return

    setBulkApproveLoading(true)
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch('/api/admin/staff', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_approved: true }),
          }),
        ),
      )
      const failed = results.filter((r) => !r.ok).length
      if (failed > 0) {
        setToastMsg(`${failed} 件の承認に失敗しました`)
      } else {
        setToastMsg(`${selectedIds.size} 名を承認しました`)
        setSelectedIds(new Set())
        router.refresh()
      }
    } catch {
      setToastMsg('承認処理に失敗しました')
    } finally {
      setBulkApproveLoading(false)
    }
  }

  function handleChange(key: keyof StaffInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openEdit(staff: ManagedStaff) {
    const normalizedSkills = expandSkillsForLeader(normalizeSkills(staff.skills ?? []))
    setEditTarget({
      id: staff.id,
      full_name: staff.full_name,
      staff_code: staff.staff_code,
      role: staff.role,
      is_active: staff.is_active,
      is_approved: staff.is_approved,
      is_deletion_requested: staff.is_deletion_requested,
      skills: normalizedSkills,
      email: staff.email ?? '',
      new_password: '',
    })
    setEditErrors(null)
  }

  function closeEdit() {
    setEditTarget(null)
    setEditErrors(null)
  }

  async function handleAddStaff(e: SyntheticEvent) {
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
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })

      if (!res.ok) {
        setToastMsg(await readErrorMessage(res, '招待メールの送信に失敗しました'))
        return
      }

      setForm({ email: '', full_name: '', staff_code: '' })
      setShowForm(false)
      setToastMsg('招待メールを送信しました。承認後に利用開始できます。')
      router.refresh()
    } catch {
      setToastMsg('招待メールの送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean, name: string) {
    setTogglingId(id)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      if (!res.ok) {
        setToastMsg(await readErrorMessage(res, '有効状態の更新に失敗しました'))
        return
      }

      setToastMsg(`${name} を${currentActive ? '無効' : '有効'}にしました`)
      router.refresh()
    } catch {
      setToastMsg('有効状態の更新に失敗しました')
    } finally {
      setTogglingId(null)
    }
  }

  function toggleSkill(skill: (typeof BASE_SKILL_OPTIONS)[number]) {
    setEditTarget((prev) => {
      if (!prev) return prev
      const nextSkills = prev.skills.includes(skill)
        ? prev.skills.filter((currentSkill) => currentSkill !== skill)
        : [...prev.skills, skill]
      return { ...prev, skills: normalizeSkills(nextSkills) }
    })
  }

  function toggleLeaderSkill(checked: boolean) {
    setEditTarget((prev) => {
      if (!prev) return prev
      if (checked) {
        // 仕込み以外を習得済みにする（仕込みは現在の状態を維持）
        const hasShikomi = prev.skills.includes('仕込み')
        const next = BASE_SKILL_OPTIONS.filter((s) => s !== '仕込み')
        return { ...prev, skills: [...next, ...(hasShikomi ? ['仕込み'] : []), LEAD_SKILL_OPTION] }
      }
      return { ...prev, skills: prev.skills.filter((skill) => skill !== LEAD_SKILL_OPTION) }
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

    const passwordToUpdate = editTarget.new_password.trim()
    if (passwordToUpdate && !window.confirm('パスワードを変更しますか？')) return

    setEditLoading(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editTarget,
          skills: expandSkillsForLeader(normalizeSkills(editTarget.skills)),
          new_password: passwordToUpdate,
        }),
      })

      if (!res.ok) {
        setEditErrors(await readErrorMessage(res, '更新に失敗しました'))
        setToastMsg('更新に失敗しました')
        return
      }

      closeEdit()
      setToastMsg(`${editTarget.full_name} の情報を更新しました`)
      router.refresh()
    } catch {
      setEditErrors('更新に失敗しました')
      setToastMsg('更新に失敗しました')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (!editTarget) return
    const confirmed = window.confirm(`「${editTarget.full_name}」のアカウントを削除しますか？この操作は取り消せません。`)
    if (!confirmed) return

    setEditLoading(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id }),
      })

      if (!res.ok) {
        setEditErrors(await readErrorMessage(res, 'アカウント削除に失敗しました'))
        setToastMsg('アカウント削除に失敗しました')
        return
      }

      closeEdit()
      setToastMsg('アカウントを削除しました')
      router.refresh()
    } catch {
      setEditErrors('アカウント削除に失敗しました')
      setToastMsg('アカウント削除に失敗しました')
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        <UserPlus className="h-4 w-4" aria-hidden />
        スタッフを招待
      </button>

      {showForm && (
        <div className="card">
          <h2 className="mb-1 text-base font-semibold text-gray-800">スタッフの招待</h2>
          <p className="mb-4 text-xs text-gray-500">
            入力したメールアドレスに招待リンクを送信します。スタッフ本人がリンクからパスワードを設定してログインします。承認は招待後に管理者が行います。
          </p>
          <form onSubmit={handleAddStaff} noValidate className="space-y-4">
            {[
              { id: 'full_name', label: '氏名', type: 'text', placeholder: '山田 太郎' },
              { id: 'staff_code', label: 'スタッフコード', type: 'text', placeholder: 'S001' },
              { id: 'email', label: 'メールアドレス', type: 'email', placeholder: 'yamada@example.com' },
            ].map(({ id, label, type, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} className="label">
                  {label} <span className="text-red-500">*</span>
                </label>
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

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '招待メールを送信'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">コード</th>
                <th className="px-4 py-3">氏名</th>
                <th className="px-4 py-3">権限</th>
                <th className="px-4 py-3 text-center">承認</th>
                <th className="px-4 py-3 text-center">有効</th>
                <th className="px-4 py-3 text-center">編集</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffList.map((staff) => (
                <tr key={staff.id} className={`transition-colors hover:bg-gray-50 ${!staff.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{staff.staff_code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{staff.full_name}</td>
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
                    {togglingId === staff.id
                      ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" aria-hidden />
                      : <Toggle
                          checked={staff.is_active}
                          onChange={() => handleToggleActive(staff.id, staff.is_active, staff.full_name)}
                          disabled={staff.role === 'admin'}
                        />
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(staff)}
                      className="text-gray-400 transition-colors hover:text-gray-700"
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
      </div>

      <div className="card overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setUnapprovedOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            未承認スタッフ
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {unapprovedStaff.length}
            </span>
          </span>
          {unapprovedOpen ? <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden /> : <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />}
        </button>

        {unapprovedOpen && (
          unapprovedStaff.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">未承認のスタッフはいません</p>
          ) : (
            <>
              <div className="flex items-center justify-between border-t border-gray-100 bg-yellow-50 px-4 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={bulkApproveLoading}
                  />
                  全選択
                  {selectedIds.size > 0 && (
                    <span className="text-xs text-gray-500">（{selectedIds.size} 名選択中）</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleBulkApprove}
                  disabled={selectedIds.size === 0 || bulkApproveLoading}
                  className="btn-primary py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {bulkApproveLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    : 'まとめて承認'
                  }
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 w-8" />
                      <th className="px-4 py-3">コード</th>
                      <th className="px-4 py-3">氏名</th>
                      <th className="px-4 py-3">権限</th>
                      <th className="px-4 py-3 text-center">有効</th>
                      <th className="px-4 py-3 text-center">編集</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unapprovedStaff.map((staff) => (
                      <tr key={staff.id} className={`transition-colors hover:bg-gray-50 ${!staff.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(staff.id)}
                            onChange={() => toggleSelect(staff.id)}
                            disabled={bulkApproveLoading}
                            aria-label={`${staff.full_name} を選択`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{staff.staff_code}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{staff.full_name}</td>
                        <td className="px-4 py-3">
                          <span className={staff.role === 'admin' ? 'badge-approved' : 'badge-submitted'}>
                            {staff.role === 'admin' ? '管理者' : 'スタッフ'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {togglingId === staff.id
                            ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" aria-hidden />
                            : <Toggle
                                checked={staff.is_active}
                                onChange={() => handleToggleActive(staff.id, staff.is_active, staff.full_name)}
                                disabled={staff.role === 'admin'}
                              />
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openEdit(staff)}
                            className="text-gray-400 transition-colors hover:text-gray-700"
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
            </>
          )
        )}
      </div>

      {editTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.40)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
              maxWidth: '560px',
              maxHeight: '88vh',
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
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '9999px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, full_name: e.target.value } : prev)}
                  className="input-field"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">スタッフコード</label>
                <input
                  type="text"
                  value={editTarget.staff_code}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, staff_code: e.target.value } : prev)}
                  className="input-field font-mono"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">メールアドレス</label>
                <input
                  type="email"
                  value={editTarget.email}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                  className="input-field"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">
                  新しいパスワード
                  <span className="ml-2 text-xs font-normal text-gray-400">未入力で変更しません</span>
                </label>
                <input
                  type="password"
                  value={editTarget.new_password}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, new_password: e.target.value } : prev)}
                  className="input-field"
                  placeholder="8文字以上"
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="label">権限</label>
                <select
                  value={editTarget.role}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, role: e.target.value as 'staff' | 'admin' } : prev)}
                  className="input-field"
                  disabled={editLoading}
                >
                  <option value="staff">スタッフ</option>
                  <option value="admin">管理者</option>
                </select>
              </div>

              <div>
                <label className="label">
                  習熟度（複数選択）
                </label>
                <div className="rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <span className="text-sm font-medium text-gray-600">時間帯責任者可</span>
                      <p className="text-xs text-gray-400">オン時は仕込み以外を習得済みにします</p>
                    </div>
                    <Toggle
                      checked={editTarget.skills.includes(LEAD_SKILL_OPTION)}
                      onChange={(v) => toggleLeaderSkill(v)}
                      disabled={editLoading}
                    />
                  </div>
                  <div className="border-t border-gray-200" />
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {BASE_SKILL_OPTIONS.map((skill) => (
                      <div key={skill} className="flex items-center justify-between text-sm text-gray-700">
                        <span>{skill}</span>
                        <Toggle
                          checked={editTarget.skills.includes(skill)}
                          onChange={() => toggleSkill(skill)}
                          disabled={editLoading || (editTarget.skills.includes(LEAD_SKILL_OPTION) && skill !== '仕込み')}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 text-sm sm:grid-cols-3">
                <div className="flex items-center justify-between text-gray-700">
                  <span>承認済み</span>
                  <Toggle
                    checked={editTarget.is_approved}
                    onChange={(v) => setEditTarget((prev) => prev ? { ...prev, is_approved: v } : prev)}
                    disabled={editLoading}
                  />
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <span>アカウント有効</span>
                  <Toggle
                    checked={editTarget.is_active}
                    onChange={(v) => setEditTarget((prev) => prev ? { ...prev, is_active: v } : prev)}
                    disabled={editLoading}
                  />
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <div>
                    <span>退会申請中</span>
                    {!editTarget.is_deletion_requested && (
                      <p className="text-xs text-gray-400">本人申請のみ可能</p>
                    )}
                  </div>
                  <Toggle
                    checked={editTarget.is_deletion_requested}
                    onChange={(v) => setEditTarget((prev) => prev ? { ...prev, is_deletion_requested: v } : prev)}
                    disabled={editLoading || !editTarget.is_deletion_requested}
                  />
                </div>
              </div>
            </div>

            {editErrors && (
              <p
                role="alert"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#d6231e',
                  background: '#fef2f2',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  margin: 0,
                }}
              >
                {editErrors}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditSave}
                disabled={editLoading}
                className="btn-primary flex-1"
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
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={editLoading}
                className="btn-secondary"
                style={{ color: '#b91c1c', borderColor: '#fecaca', backgroundColor: '#fff1f2' }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
