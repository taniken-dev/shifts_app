'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, CalendarDays, Users, LayoutList, ClipboardList, UserCircle2 } from 'lucide-react'
import LogoutButton from './LogoutButton'

interface MobileMenuProps {
  isAdmin:  boolean
  fullName: string
}

export default function MobileMenu({ isAdmin, fullName }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const links = isAdmin
    ? [
        { href: '/admin/shifts',    icon: <LayoutList    size={17} aria-hidden />, label: 'シフト一覧' },
        { href: '/admin/schedule',  icon: <ClipboardList size={17} aria-hidden />, label: 'ワークスケジュール' },
        { href: '/admin/staff',     icon: <Users         size={17} aria-hidden />, label: 'スタッフ管理' },
      ]
      : [
         { href: '/staff/shifts', icon: <CalendarDays size={17} aria-hidden />, label: 'シフト希望' },
         { href: '/staff/profile', icon: <UserCircle2 size={17} aria-hidden />, label: 'プロフィール' },
       ]

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '38px', height: '38px', borderRadius: '10px',
          backgroundColor: isOpen ? '#f3f4f6' : 'transparent',
          border: `1.5px solid ${isOpen ? '#d1d5db' : '#e5e7eb'}`,
          cursor: 'pointer', color: '#374151',
          transition: 'all 150ms ease', flexShrink: 0,
        }}
      >
        {isOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
      </button>

      {isOpen && (
        <>
          {/* 背景クリックで閉じるオーバーレイ */}
          <div
            aria-hidden
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0, top: '52px', zIndex: 25,
              backgroundColor: 'rgba(0,0,0,0.18)',
            }}
          />

          {/* ドロップダウンパネル */}
          <div
            role="dialog"
            aria-label="ナビゲーションメニュー"
            style={{
              position: 'fixed', top: '52px', left: 0, right: 0, zIndex: 30,
              backgroundColor: '#fff',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              padding: '8px 12px 20px',
              animation: 'slide-down 160ms ease',
            }}
          >
            {/* ナビリンク */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '13px',
                    padding: '14px 16px', borderRadius: '12px',
                    fontSize: '15px', fontWeight: 600, color: '#111827',
                    textDecoration: 'none',
                    transition: 'background-color 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <span style={{ color: '#6b7280' }}>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* 区切り線 */}
            <div style={{ margin: '10px 4px', borderTop: '1px solid #f3f4f6' }} />

            {/* ユーザー情報 + ログアウト */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px 0',
            }}>
              <span style={{
                fontSize: '13px', color: '#9ca3af', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '160px',
              }}>
                {fullName}
              </span>
              <LogoutButton />
            </div>
          </div>
        </>
      )}
    </>
  )
}
