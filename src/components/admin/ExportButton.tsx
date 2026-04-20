'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface ExportButtonProps {
  month: string // "YYYY-MM"
}

export default function ExportButton({ month }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/export?month=${encodeURIComponent(month)}`)
      if (!res.ok) throw new Error('export failed')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `shifts_${month}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('エクスポートに失敗しました。再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="btn-secondary text-sm"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          出力中...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden />
          CSVエクスポート
        </>
      )}
    </button>
  )
}
