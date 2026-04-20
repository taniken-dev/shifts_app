'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock, FileText, Send, Loader2 } from 'lucide-react'
import { shiftSchema } from '@/lib/validations/shift'
import { createClient } from '@/lib/supabase/client'

type FieldErrors = Partial<Record<'shift_date' | 'start_time' | 'end_time' | 'note', string>>

// 今日の日付を YYYY-MM-DD 形式で取得
function todayString() {
  return new Date().toISOString().split('T')[0]
}

export default function ShiftForm() {
  const router = useRouter()
  const [shiftDate, setShiftDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [note, setNote]           = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)
    setSuccess(false)

    // --- フロントエンドバリデーション (Zod) ---
    const result = shiftSchema.safeParse({
      shift_date: shiftDate,
      start_time: startTime,
      end_time:   endTime,
      note:       note || null,
    })

    if (!result.success) {
      const errs: FieldErrors = {}
      result.error.errors.forEach((e) => {
        const key = e.path[0] as keyof FieldErrors
        if (key) errs[key] = e.message
      })
      setFieldErrors(errs)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setServerError('セッションが切れました。再ログインしてください。')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('shifts').insert({
      profile_id: user.id,
      shift_date: result.data.shift_date,
      start_time: result.data.start_time,
      end_time:   result.data.end_time,
      note:       result.data.note ?? null,
    })

    if (error) {
      // 一意制約違反 = 同日に既に提出済み
      if (error.code === '23505') {
        setServerError('この日付は既にシフト希望を提出済みです。既存のシフトを編集してください。')
      } else {
        setServerError('送信に失敗しました。時間をおいて再試行してください。')
      }
      setLoading(false)
      return
    }

    // 成功
    setSuccess(true)
    setShiftDate('')
    setStartTime('')
    setEndTime('')
    setNote('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* 日付 */}
        <div>
          <label htmlFor="shift_date" className="label">
            <CalendarDays className="inline h-4 w-4 mr-1 text-gray-400" aria-hidden />
            希望日 <span className="text-red-500">*</span>
          </label>
          <input
            id="shift_date"
            type="date"
            required
            min={todayString()}
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            className={`input-field ${fieldErrors.shift_date ? 'input-error' : ''}`}
            disabled={loading}
          />
          {fieldErrors.shift_date && (
            <p className="error-message">{fieldErrors.shift_date}</p>
          )}
        </div>

        {/* 開始・終了時間 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start_time" className="label">
              <Clock className="inline h-4 w-4 mr-1 text-gray-400" aria-hidden />
              開始時間 <span className="text-red-500">*</span>
            </label>
            <input
              id="start_time"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`input-field ${fieldErrors.start_time ? 'input-error' : ''}`}
              disabled={loading}
            />
            {fieldErrors.start_time && (
              <p className="error-message">{fieldErrors.start_time}</p>
            )}
          </div>
          <div>
            <label htmlFor="end_time" className="label">
              <Clock className="inline h-4 w-4 mr-1 text-gray-400" aria-hidden />
              終了時間 <span className="text-red-500">*</span>
            </label>
            <input
              id="end_time"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`input-field ${fieldErrors.end_time ? 'input-error' : ''}`}
              disabled={loading}
            />
            {fieldErrors.end_time && (
              <p className="error-message">{fieldErrors.end_time}</p>
            )}
          </div>
        </div>

        {/* 備考 */}
        <div>
          <label htmlFor="note" className="label">
            <FileText className="inline h-4 w-4 mr-1 text-gray-400" aria-hidden />
            備考 <span className="text-xs text-gray-400 font-normal">(任意・500文字以内)</span>
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`input-field resize-none ${fieldErrors.note ? 'input-error' : ''}`}
            placeholder="テスト期間中なので午後のみ希望、など"
            disabled={loading}
          />
          <div className="flex justify-between mt-1">
            {fieldErrors.note
              ? <p className="error-message">{fieldErrors.note}</p>
              : <span />
            }
            <span className="text-xs text-gray-400">{note.length}/500</span>
          </div>
        </div>

        {/* エラー・成功メッセージ */}
        {serverError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
            シフト希望を提出しました！
          </p>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              送信中...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              シフトを提出する
            </>
          )}
        </button>
      </form>
    </div>
  )
}
