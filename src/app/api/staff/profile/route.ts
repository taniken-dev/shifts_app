import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const patchSchema = z.object({
  action: z.literal('request_deletion'),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const { error } = await supabase
    .from('profiles')
    .update({ is_deletion_requested: true })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: '退会申請に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
