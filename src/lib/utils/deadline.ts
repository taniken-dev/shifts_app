type Period = 'first' | 'second'

/**
 * true のとき、提出期限・承認禁止期間のチェックをすべて無効化する。
 * 開発・テスト専用。本番では NEXT_PUBLIC_BYPASS_DEADLINE を設定しないこと。
 */
export const BYPASS_DEADLINE =
  process.env.NEXT_PUBLIC_BYPASS_DEADLINE === 'true'

/**
 * シフト提出期限を計算する
 * 前半（1〜15日）: 前月20日 23:59:59
 * 後半（16〜末日）: 当月5日 23:59:59
 */
export function calcDeadline(month: string, period: Period): Date {
  const [y, m] = month.split('-').map(Number)
  if (period === 'first') {
    const prevY = m === 1 ? y - 1 : y
    const prevM = m === 1 ? 12 : m - 1
    return new Date(prevY, prevM - 1, 20, 23, 59, 59)
  } else {
    return new Date(y, m - 1, 5, 23, 59, 59)
  }
}

export function formatDeadline(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 23:59`
}
