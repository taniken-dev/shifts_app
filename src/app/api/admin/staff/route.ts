import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { staffSchema } from '@/lib/validations/shift'
import { z } from 'zod'

/** 管理者権限チェック共通処理 */
async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403, supabase: null, user: null }
  }

  return { error: null, status: 200, supabase, user }
}

// POST /api/admin/staff — 新規スタッフ登録
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

  const { email, full_name, staff_code, password } = result.data

  // Service Role でユーザー作成（RLS をバイパスする必要があるため）
  const admin = createServiceRoleClient()
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'staff' },
  })

  if (createError) {
    if (createError.message.includes('already registered')) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 },
      )
    }
    console.error('createUser error:', createError.message)
    return NextResponse.json({ error: 'ユーザーの作成に失敗しました' }, { status: 500 })
  }

  // profiles の staff_code と full_name を確定値で更新（トリガーで仮値が入っているため）
  const { error: profileError } = await admin
    .from('profiles')
    .update({ staff_code, full_name })
    .eq('id', newUser.user.id)

  if (profileError) {
    console.error('profile update error:', profileError.message)
    // ユーザーは作成済みなのでロールバックはしない（手動で修正できる）
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// PUT /api/admin/staff — プロフィール編集
const putSchema = z.object({
  id:         z.string().uuid(),
  full_name:  z.string().min(1, '氏名を入力してください'),
  staff_code: z.string().min(1, 'スタッフコードを入力してください'),
  role:       z.enum(['staff', 'admin']),
  is_active:  z.boolean(),
  level:      z.number().int().min(1).max(6).nullable().optional(),
})

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

  const { id, full_name, staff_code, role, is_active, level } = result.data

  if (id === user.id && role !== 'admin') {
    return NextResponse.json({ error: '自分自身の権限は変更できません' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ full_name, staff_code, role, is_active, level: level ?? null })
    .eq('id', id)

  if (updateError) {
    console.error('profile PUT error:', updateError.message)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/staff — is_active トグル
const patchSchema = z.object({
  id:        z.string().uuid(),
  is_active: z.boolean(),
})

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

  const { id, is_active } = result.data

  // 対象スタッフが管理者でないことを確認（管理者の is_active は変更不可）
  const { data: target } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', id)
    .single()

  if (target?.role === 'admin') {
    return NextResponse.json({ error: '管理者アカウントは変更できません' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_active })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
