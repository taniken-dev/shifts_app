import Link from 'next/link'
import { CalendarDays, Users, LayoutList, ClipboardList } from 'lucide-react'
import type { Role } from '@/types/database'
import LogoutButton from './LogoutButton'
import MobileMenu from './MobileMenu'

interface NavBarProps {
  fullName: string
  role: Role
}

export default function NavBar({ fullName, role }: NavBarProps) {
  const isAdmin = role === 'admin'

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '52px',
          padding: '0 16px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ロゴ */}
        <Link
          href={isAdmin ? '/admin/shifts' : '/staff/shifts'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#006633',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>M</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>MOS</span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#006633', letterSpacing: '-0.02em' }}>SHIFT</span>
          </div>
        </Link>

        {/* デスクトップ中央ナビ（md以上で表示） */}
        <nav className="hidden md:flex" style={{ alignItems: 'center', gap: '2px' }}>
          {isAdmin ? (
            <>
              <NavLink href="/admin/shifts" icon={<LayoutList size={14} aria-hidden />}>
                シフト一覧
              </NavLink>
              <NavLink href="/admin/schedule" icon={<ClipboardList size={14} aria-hidden />}>
                ワークスケジュール
              </NavLink>
              <NavLink href="/admin/staff" icon={<Users size={14} aria-hidden />}>
                スタッフ管理
              </NavLink>
            </>
          ) : (
            <NavLink href="/staff/shifts" icon={<CalendarDays size={14} aria-hidden />}>
              シフト希望
            </NavLink>
          )}
        </nav>

        {/* デスクトップ右端（md以上で表示） */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              maxWidth: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fullName}
          </span>
          <LogoutButton />
        </div>

        {/* モバイル用ハンバーガー（md未満で表示） */}
        <div className="md:hidden">
          <MobileMenu isAdmin={isAdmin} fullName={fullName} />
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#6b7280',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'all 150ms ease',
      }}
    >
      {icon}
      {children}
    </Link>
  )
}
