'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
}

interface TimeEntry {
  id: string
  type: string
  timestamp: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clock, setClock] = useState(new Date())

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Carrega Usuário e Pontos Iniciais
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/auth/me')
        if (userRes.status === 401) {
          router.push('/login')
          return
        }
        const userData = await userRes.json()
        setUser(userData.user)

        const pointsRes = await fetch('/api/ponto')
        if (pointsRes.ok) {
          const pointsData = await pointsRes.json()
          setEntries(pointsData.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const handleBaterPonto = async () => {
    try {
      const res = await fetch('/api/ponto', { method: 'POST' })
      if (res.ok) {
        const { data } = await res.json()
        setEntries([data, ...entries])
      }
    } catch (error) {
      console.error(error)
      alert("Erro ao registrar ponto.")
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>
  }

  const lastEntry = entries[0]
  const isWorking = lastEntry?.type === 'ENTRADA'

  return (
    <div style={{ flex: 1, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Navbar Superior */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Olá, {user?.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.email}</p>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          Sair
        </button>
      </div>

      {/* Seção Principal - Relógio e Botão */}
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '800px', padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
        
        <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-2px', marginBottom: '10px' }}>
          {clock.toLocaleTimeString('pt-BR')}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
          <span style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            background: isWorking ? 'var(--success)' : 'var(--text-secondary)',
            boxShadow: isWorking ? '0 0 10px var(--success)' : 'none'
          }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
            {isWorking ? 'Você está TRABALHANDO' : 'Você está OFFLINE'}
          </span>
        </div>

        <button 
          onClick={handleBaterPonto}
          className="btn-primary" 
          style={{ 
            maxWidth: '300px', 
            height: '60px', 
            fontSize: '1.2rem', 
            background: isWorking ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
            boxShadow: isWorking ? '0 4px 15px rgba(239, 68, 68, 0.3)' : '0 4px 15px rgba(16, 185, 129, 0.3)'
          }}
        >
          {isWorking ? 'REGISTRAR SAÍDA' : 'REGISTRAR ENTRADA'}
        </button>
      </div>

      {/* Histórico */}
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Histórico Recente</h3>
        
        {entries.length === 0 ? (
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhum registro encontrado.
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '0px' }}>
            {entries.map((entry, idx) => (
              <div key={entry.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '20px', 
                borderBottom: idx !== entries.length - 1 ? '1px solid var(--glass-border)' : 'none' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    background: entry.type === 'ENTRADA' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: entry.type === 'ENTRADA' ? 'var(--success)' : 'var(--danger)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    {entry.type}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {new Date(entry.timestamp).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
