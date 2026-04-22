import LogoutButton from '@/components/ui/LogoutButton'

export default function PendingScreen() {
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
      <div className="card-elevated" style={{ width: '100%', maxWidth: '26rem', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '9999px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            fontSize: '24px',
            fontWeight: 900,
            marginBottom: '14px',
          }}
        >
          !
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
          承認待ちです
        </h1>
        <p style={{ fontSize: '14px', color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          このアカウントはまだ承認されていません。
          <br />
          店長の承認後にシフト管理画面を利用できます。
        </p>
        <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'center' }}>
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
