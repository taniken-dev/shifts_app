import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { BASE_SKILL_OPTIONS, LEAD_SKILL_OPTION, SKILL_OPTIONS } from '@/lib/constants/skills'
import { staffSchema } from '@/lib/validations/shift'
import { z } from 'zod'

/** 管理者権限チェック共通処理 */
async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_approved')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' || !profile.is_approved) {
    return { error: 'Forbidden', status: 403, supabase: null, user: null }
  }

  return { error: null, status: 200, supabase, user }
}

// POST /api/admin/staff — スタッフ招待メール送信
export async function POST(request: NextRequest) {
  const { error, status, supabase } = await assertAdmin()
  if (error || !supabase) {
    return NextResponse.json({ error }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = staffSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Invalid input' },
      { status: 422 },
    )
  }

  const { email, full_name, staff_code } = result.data

  const redirectTo = new URL('/auth/callback', request.nextUrl.origin)
  redirectTo.searchParams.set(
    'next',
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/dashboard',
  )

  // Service Role でユーザー招待（スタッフ本人がメールからパスワード設定）
  const admin = createServiceRoleClient()
  const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role: 'staff' },
    redirectTo: redirectTo.toString(),
  })

  if (inviteError) {
    if (inviteError.message.includes('already registered')) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 },
      )
    }
    console.error('inviteUserByEmail error:', inviteError.message)
    return NextResponse.json(
      { error: `招待メールの送信に失敗しました: ${inviteError.message}` },
      { status: 500 },
    )
  }

  const invitedUserId = invitedUser.user?.id
  if (!invitedUserId) {
    return NextResponse.json({ error: '招待ユーザーの作成に失敗しました' }, { status: 500 })
  }

  // profiles の staff_code と full_name を確定値で更新（トリガーで仮値が入っているため）
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      staff_code,
      full_name,
      is_approved: false,
      is_deletion_requested: false,
      skills: [],
    })
    .eq('id', invitedUserId)

  if (profileError) {
    console.error('profile update error:', profileError.message)
    // 招待メールは送信済みなのでロールバックしない（管理画面で手動修正可能）
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// PUT /api/admin/staff — プロフィール編集
const putSchema = z.object({
  id:                   z.string().uuid(),
  full_name:            z.string().min(1, '氏名を入力してください'),
  staff_code:           z.string().min(1, 'スタッフコードを入力してください'),
  role:                 z.enum(['staff', 'admin']),
  is_active:            z.boolean(),
  is_approved:          z.boolean().optional(),
  skills:               z.array(z.enum(SKILL_OPTIONS)).default([]),
  email:                z.string().email('有効なメールアドレスを入力してください').toLowerCase(),
  new_password:         z.string().min(8, 'パスワードは8文字以上にしてください').optional().or(z.literal('')),
  is_deletion_requested:z.boolean().optional(),
})

function normalizeAndExpandSkills(inputSkills: readonly string[]) {
  const uniqueValid = Array.from(new Set(inputSkills)).filter((skill): skill is (typeof SKILL_OPTIONS)[number] =>
    SKILL_OPTIONS.includes(skill as (typeof SKILL_OPTIONS)[number]),
  )

  if (uniqueValid.includes(LEAD_SKILL_OPTION)) {
    return [...BASE_SKILL_OPTIONS, LEAD_SKILL_OPTION]
  }

  return uniqueValid
}

export async function PUT(request: NextRequest) {
  const { error, status, supabase, user } = await assertAdmin()
  if (error || !supabase || !user) {
    return NextResponse.json({ error }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = putSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Invalid input' },
      { status: 422 },
    )
  }

  const { id, full_name, staff_code, role, is_active, is_approved, skills, email, new_password, is_deletion_requested } = result.data
  const normalizedSkills = normalizeAndExpandSkills(skills)

  if (id === user.id && role !== 'admin') {
    return NextResponse.json({ error: '自分自身の権限は変更できません' }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const passwordToUpdate = new_password?.trim() ? new_password.trim() : null

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, {
    email,
    ...(passwordToUpdate ? { password: passwordToUpdate } : {}),
  })

  if (authUpdateError) {
    console.error('auth user update error:', authUpdateError.message)
    return NextResponse.json({ error: 'メールアドレスまたはパスワードの更新に失敗しました' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      full_name,
      staff_code,
      role,
      is_active,
      ...(is_approved !== undefined ? { is_approved } : {}),
      skills: normalizedSkills,
      ...(is_deletion_requested !== undefined ? { is_deletion_requested } : {}),
    })
    .eq('id', id)

  if (updateError) {
    console.error('profile PUT error:', updateError.message)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/staff — is_active / is_approved 更新
const patchSchema = z.object({
  id:                    z.string().uuid(),
  is_active:             z.boolean().optional(),
  is_approved:           z.boolean().optional(),
  is_deletion_requested: z.boolean().optional(),
}).refine(
  (value) =>
    value.is_active !== undefined ||
    value.is_approved !== undefined ||
    value.is_deletion_requested !== undefined,
  { message: '更新項目がありません' },
)

export async function PATCH(request: NextRequest) {
  const { error, status, supabase } = await assertAdmin()
  if (error || !supabase) {
    return NextResponse.json({ error }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = patchSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  const { id, is_active, is_approved, is_deletion_requested } = result.data

  // 対象スタッフが管理者でないことを確認（管理者の is_active は変更不可）
  const { data: target } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', id)
    .single()

  if (target?.role === 'admin' && is_active !== undefined) {
    return NextResponse.json({ error: '管理者アカウントは変更できません' }, { status: 403 })
  }

  const updates: { is_active?: boolean; is_approved?: boolean; is_deletion_requested?: boolean } = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (is_approved !== undefined) updates.is_approved = is_approved
  if (is_deletion_requested !== undefined) updates.is_deletion_requested = is_deletion_requested

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export async function DELETE(request: NextRequest) {
  const { error, status, user } = await assertAdmin()
  if (error || !user) {
    return NextResponse.json({ error }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = deleteSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  if (result.data.id === user.id) {
    return NextResponse.json({ error: '自分自身のアカウントは削除できません' }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const { error: deleteError } = await admin.auth.admin.deleteUser(result.data.id)
  if (deleteError) {
    return NextResponse.json({ error: 'アカウント削除に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
