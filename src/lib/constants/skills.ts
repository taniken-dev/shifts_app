export const BASE_SKILL_OPTIONS = [
  'レジ',
  'ドライブスルー',
  'カスタマー',
  'フライヤー',
  'セッター',
  '仕込み',
] as const

export const LEAD_SKILL_OPTION = '時間帯責任者' as const

export const SKILL_OPTIONS = [
  ...BASE_SKILL_OPTIONS,
  LEAD_SKILL_OPTION,
] as const

export type SkillOption = (typeof SKILL_OPTIONS)[number]
