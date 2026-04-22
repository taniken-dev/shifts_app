'use server'

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles').select('role, is_approved').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.is_approved) throw new Error('Forbidden')
  return createServiceRoleClient()
}

export interface UpsertShiftPayload {
  dbId?:      string
  profileId:  string
  shiftDate:  string
  startTime:  string
  endTime:    string
  position:   string | null
}

export async function upsertConfirmedShift(
  payload: UpsertShiftPayload,
): Promise<{ id: string }> {
  const db = await requireAdmin()

  const common = {
    start_time:     payload.startTime,
    end_time:       payload.endTime,
    status:         'approved' as const,
    admin_adjusted: true,
    position:       payload.position,
    is_open_end:    false,
    is_open_start:  false,
    note:           null,
  }

  if (payload.dbId) {
    // 既存行の更新（Update 型は status を持つ）
    const { error } = await db
      .from('shifts')
      .update(common)
      .eq('id', payload.dbId)
    if (error) throw new Error(error.message)
    return { id: payload.dbId }
  } else {
    // (profile_id, shift_date) の既存行を確認（unique 制約があるため）
    const { data: existing } = await db
      .from('shifts')
      .select('id')
      .eq('profile_id', payload.profileId)
      .eq('shift_date', payload.shiftDate)
      .maybeSingle()

    if (existing) {
      // 既存行があれば UPDATE
      const { error } = await db
        .from('shifts')
        .update(common)
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
      return { id: existing.id }
    }

    // 既存行なし → INSERT（status はDBデフォルト 'submitted'）、その後 UPDATE
    const insertPayload = {
      profile_id:     payload.profileId,
      shift_date:     payload.shiftDate,
      start_time:     payload.startTime,
      end_time:       payload.endTime,
      admin_adjusted: true,
      position:       payload.position,
      is_open_end:    false,
      is_open_start:  false,
      note:           null,
    }
    const { data, error: insertErr } = await db
      .from('shifts')
      .insert(insertPayload)
      .select('id')
      .single()
    if (insertErr) throw new Error(insertErr.message)

    const { error: updateErr } = await db
      .from('shifts')
      .update({ status: 'approved' })
      .eq('id', data.id)
    if (updateErr) throw new Error(updateErr.message)

    return { id: data.id }
  }
}

export async function deleteConfirmedShift(id: string): Promise<void> {
  const db = await requireAdmin()
  const { error } = await db.from('shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
