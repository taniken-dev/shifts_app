import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { BASE_SKILL_OPTIONS, LEAD_SKILL_OPTION, SKILL_OPTIONS } from '@/lib/constants/skills'
import { staffSchema } from '@/lib/validations/shift'
import { z } from 'zod'

/**
 * 管理者権限チェック共通処理
 * is_demo を返すことで、デモ管理者が本番データを操作できないよう各ハンドラで制御する
 */
async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, user: null, isDemo: false }

  const svc = createServiceRoleClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('role, is_approved, is_demo')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' || !profile.is_approved) {
    return { error: 'Forbidden', status: 403, user: null, isDemo: false }
  }

  return { error: null, status: 200, user, isDemo: profile.is_demo ?? false }
}

/**
 * 操作対象プロフィールの is_demo を取得し、ログイン中の管理者と一致するか確認する。
 * 不一致の場合はデモ←→本番の越境操作なので 403 を返す。
 */
async function assertSameDemoScope(
  targetId: string,
  adminIsDemo: boolean,
): Promise<{ error: string; status: number } | null> {
  const svc = createServiceRoleClient()
  const { data: target } = await svc
    .from('profiles')
    .select('is_demo')
    .eq('id', targetId)
    .single()

  if (!target) return { error: '対象ユーザーが見つかりません', status: 404 }

  if ((target.is_demo ?? false) !== adminIsDemo) {
    return { error: 'デモと本番のデータは相互に操作できません', status: 403 }
  }

  return null
}

// POST /api/admin/staff — スタッフ招待メール送信
export async function POST(request: NextRequest) {
  const { error, status, isDemo } = await assertAdmin()
  if (error) return NextResponse.json({ error }, { status })

  // デモ管理者は新規招待不可（本番の auth.users を汚染させない）
  if (isDemo) {
    return NextResponse.json({ error: 'デモアカウントでは招待メールを送信できません' }, { status: 403 })
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

  const svc = createServiceRoleClient()
  const { data: invitedUser, error: inviteError } = await svc.auth.admin.inviteUserByEmail(email, {
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

  const { error: profileError } = await svc
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
  const { error, status, user, isDemo } = await assertAdmin()
  if (error || !user) return NextResponse.json({ error }, { status })

  if (isDemo) {
    return NextResponse.json({ error: 'デモアカウントではスタッフ情報を編集できません' }, { status: 403 })
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

  // デモ境界チェック：管理者と対象スタッフの is_demo が一致しなければ拒否
  const scopeError = await assertSameDemoScope(id, isDemo)
  if (scopeError) return NextResponse.json({ error: scopeError.error }, { status: scopeError.status })

  const svc = createServiceRoleClient()
  const passwordToUpdate = new_password?.trim() ? new_password.trim() : null

  const { error: authUpdateError } = await svc.auth.admin.updateUserById(id, {
    email,
    ...(passwordToUpdate ? { password: passwordToUpdate } : {}),
  })

  if (authUpdateError) {
    console.error('auth user update error:', authUpdateError.message)
    return NextResponse.json({ error: 'メールアドレスまたはパスワードの更新に失敗しました' }, { status: 500 })
  }

  const { error: updateError } = await svc
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
  const { error, status, isDemo } = await assertAdmin()
  if (error) return NextResponse.json({ error }, { status })

  if (isDemo) {
    return NextResponse.json({ error: 'デモアカウントでは承認・有効状態を変更できません' }, { status: 403 })
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

  // デモ境界チェック
  const scopeError = await assertSameDemoScope(id, isDemo)
  if (scopeError) return NextResponse.json({ error: scopeError.error }, { status: scopeError.status })

  const svc = createServiceRoleClient()

  const { data: target } = await svc
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

  const { error: updateError } = await svc
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
  const { error, status, user, isDemo } = await assertAdmin()
  if (error || !user) return NextResponse.json({ error }, { status })

  // デモ管理者はアカウント削除不可
  if (isDemo) {
    return NextResponse.json({ error: 'デモアカウントでは削除できません' }, { status: 403 })
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

  const svc = createServiceRoleClient()
  const { error: deleteError } = await svc.auth.admin.deleteUser(result.data.id)
  if (deleteError) {
    return NextResponse.json({ error: 'アカウント削除に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
