import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '60px 40px', textAlign: 'center' }}>
        
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          border: '1px solid rgba(99, 102, 241, 0.3)'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>

        <h1 style={{ fontSize: '2.5rem', marginBottom: '16px', fontWeight: 700 }}>Time Tracker</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '40px', lineHeight: 1.6 }}>
          O sistema definitivo para você registrar e gerenciar sua jornada de estudos ou trabalho com uma interface linda e moderna.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/login" style={{ flex: 1, maxWidth: '200px' }}>
            <button className="btn-primary">Entrar no Sistema</button>
          </Link>
          <Link href="/registro" style={{ flex: 1, maxWidth: '200px' }}>
            <button className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--glass-border)', boxShadow: 'none' }}>
              Criar Conta
            </button>
          </Link>
        </div>

      </div>
    </div>
  )
}
