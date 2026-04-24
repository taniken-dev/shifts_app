'use client'

import { FlaskConical } from 'lucide-react'

export default function DemoBanner() {
  return (
    <div
      role="banner"
      aria-label="デモ環境の通知"
      style={{
        position:        'sticky',
        top:             0,
        zIndex:          60,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             '8px',
        padding:         '8px 16px',
        backgroundColor: '#fef08a', // yellow-200
        borderBottom:    '1px solid #fde047',
        fontSize:        '13px',
        fontWeight:      600,
        color:           '#854d0e', // yellow-900
        lineHeight:      1.4,
        textAlign:       'center',
      }}
    >
      <FlaskConical
        aria-hidden
        style={{ width: '15px', height: '15px', flexShrink: 0, color: '#a16207' }}
      />
      <span>
        デモ環境：シフトの提出・確認機能を体験できます。編集内容は保存されますが、アカウント設定の変更は制限されています。
      </span>
    </div>
  )
}
