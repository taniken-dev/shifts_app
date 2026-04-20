import { z } from 'zod'

// HH:MM 形式のバリデーション
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const shiftSchema = z
  .object({
    shift_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません (YYYY-MM-DD)')
      .refine((val) => {
        const date = new Date(val)
        return !isNaN(date.getTime())
      }, '有効な日付を入力してください'),

    start_time: z
      .string()
      .regex(timeRegex, '開始時間の形式が正しくありません (HH:MM)'),

    end_time: z
      .string()
      .regex(timeRegex, '終了時間の形式が正しくありません (HH:MM)'),

    note: z
      .string()
      .max(500, '備考は500文字以内で入力してください')
      .optional()
      .nullable(),

    is_open_end:   z.boolean().optional().default(false),
    is_open_start: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      // 終了時間 > 開始時間 のチェック
      const [sh, sm] = data.start_time.split(':').map(Number)
      const [eh, em] = data.end_time.split(':').map(Number)
      return eh * 60 + em > sh * 60 + sm
    },
    {
      message: '終了時間は開始時間より後に設定してください',
      path: ['end_time'],
    },
  )
  .refine(
    (data) => {
      // 過去日のシフト提出を防止（当日は許可）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const shiftDay = new Date(data.shift_date)
      return shiftDay >= today
    },
    {
      message: '過去の日付にはシフトを提出できません',
      path: ['shift_date'],
    },
  )

export type ShiftInput = z.infer<typeof shiftSchema>

// ステータス更新（管理者専用）
export const shiftStatusSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: '無効なステータスです' }),
  }),
})

export type ShiftStatusInput = z.infer<typeof shiftStatusSchema>

// スタッフ登録（管理者専用）
export const staffSchema = z.object({
  email: z
    .string()
    .email('有効なメールアドレスを入力してください')
    .toLowerCase(),
  full_name: z
    .string()
    .min(1, '氏名を入力してください')
    .max(50, '氏名は50文字以内で入力してください'),
  staff_code: z
    .string()
    .min(1, 'スタッフコードを入力してください')
    .max(10, 'スタッフコードは10文字以内にしてください')
    .regex(/^[A-Za-z0-9]+$/, 'スタッフコードは英数字のみ使用できます'),
  password: z
    .string()
    .min(8, 'パスワードは8文字以上にしてください')
    .regex(/[A-Z]/, '大文字を1文字以上含めてください')
    .regex(/[0-9]/, '数字を1文字以上含めてください'),
})

export type StaffInput = z.infer<typeof staffSchema>
