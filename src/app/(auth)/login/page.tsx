import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'ログイン' }

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F5F5F7',
        display: 'grid',
        placeItems: 'center',
        padding: '3rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '26rem' }}>

        {/*
          ブランドヘッダーカード
          角丸グリーン背景、ログインカードと同じ横幅に収まる
        */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#006633',
            borderRadius: '20px',
            padding: '32px 28px 28px',
            textAlign: 'center',
            marginBottom: '10px',
            boxShadow: '0 4px 24px rgba(0,102,51,0.22), 0 1px 4px rgba(0,102,51,0.10)',
          }}
        >
          {/* M アイコン */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255,255,255,0.16)',
              marginBottom: '14px',
            }}
          >
            <span
              style={{
                fontSize: '26px',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              M
            </span>
          </div>

          <h1
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              margin: '0 0 5px',
            }}
          >
            MOS SHIFT
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.65)',
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            シフト管理システム
          </p>
        </div>

        {/* ログインカード */}
        <Suspense>
          <LoginForm />
        </Suspense>

        {/* フッター */}
        <p
          style={{
            marginTop: '24px',
            fontSize: '11px',
            textAlign: 'center',
            color: '#9ca3af',
          }}
        >
          © {new Date().getFullYear()} MOS SHIFT — 店舗スタッフ専用
        </p>
      </div>
    </div>
  )
}
