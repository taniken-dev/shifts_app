'use client'

import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

interface ToastProps {
  message:   string
  onClose:   () => void
  duration?: number
}

export function Toast({ message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [onClose, duration])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:        'fixed',
        bottom:          '32px',
        left:            '50%',
        transform:       'translateX(-50%)',
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        gap:             '10px',
        padding:         '14px 18px',
        borderRadius:    '18px',
        backgroundColor: 'rgba(24,24,26,0.90)',
        backdropFilter:  'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        color:           '#ffffff',
        fontSize:        '14px',
        fontWeight:      600,
        letterSpacing:   '-0.01em',
        lineHeight:      1.45,
        boxShadow:       '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)',
        maxWidth:        'calc(100vw - 48px)',
        animation:       'toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        whiteSpace:      'pre-wrap',
      }}
    >
      <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0 }} aria-hidden />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        style={{
          background:    'none',
          border:        'none',
          cursor:        'pointer',
          color:         'rgba(255,255,255,0.5)',
          padding:       '2px',
          display:       'flex',
          alignItems:    'center',
          borderRadius:  '9999px',
          flexShrink:    0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
