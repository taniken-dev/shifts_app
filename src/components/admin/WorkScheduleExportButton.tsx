'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'

interface WorkScheduleExportButtonProps {
  month:  string              // "YYYY-MM"
  period: 'first' | 'second'  // 前半 or 後半
}

/**
 * 前半 or 後半まとめてワークスケジュール表 (.xlsx) をダウンロードするボタン。
 * 管理者専用。1ファイル・日付ごとにシートが分かれた構成で出力される。
 */
export default function WorkScheduleExportButton({
  month,
  period,
}: WorkScheduleExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [, m] = month.split('-').map(Number)
  const periodLabel = period === 'first' ? '前半（1〜15日）' : '後半（16〜末日）'
  const filename    = `workschedule_${month}_${period === 'first' ? '前半' : '後半'}.xlsx`

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/export/xlsx?month=${encodeURIComponent(month)}&period=${period}`
      const res = await fetch(url)

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'エクスポートに失敗しました')
      }

      const blob   = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href       = objUrl
      a.download   = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エクスポートに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        title={`${m}月${periodLabel}のワークスケジュール表を Excel でダウンロード（日付ごとにシートを分けた1ファイル）`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '10px 18px', borderRadius: '10px', minHeight: '44px',
          backgroundColor: loading ? '#f3f4f6' : '#f3f4f6',
          color: loading ? '#9ca3af' : '#374151',
          fontSize: '13px', fontWeight: 700,
          border: '1.5px solid #e5e7eb',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 180ms ease',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" aria-hidden />生成中...</>
        ) : (
          <><FileSpreadsheet size={14} aria-hidden />ワークスケジュール表</>
        )}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
