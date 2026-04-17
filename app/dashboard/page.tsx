'use client'

import { useEffect, useState, useMemo } from 'react'
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

  // Filtros
  const [filterType, setFilterType] = useState<string>('all') // 'all', '3', '7', '15', '30', 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchPoints = async () => {
    try {
      let url = '/api/ponto'
      const queryParams = new URLSearchParams()
      
      if (filterType !== 'all' && filterType !== 'custom') {
        const days = parseInt(filterType, 10)
        const start = new Date()
        start.setDate(start.getDate() - days)
        // Reset to midnight
        start.setHours(0, 0, 0, 0)
        queryParams.append('startDate', start.toISOString())
      } else if (filterType === 'custom') {
        if (customStartDate) queryParams.append('startDate', customStartDate)
        if (customEndDate) queryParams.append('endDate', customEndDate)
      } else {
        queryParams.append('limit', '50')
      }

      const pointsRes = await fetch(`${url}?${queryParams.toString()}`)
      if (pointsRes.ok) {
        const pointsData = await pointsRes.json()
        setEntries(pointsData.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

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

        await fetchPoints()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router, filterType, customStartDate, customEndDate])

  const handleBaterPonto = async () => {
    try {
      const res = await fetch('/api/ponto', { method: 'POST' })
      if (res.ok) {
        await fetchPoints()
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

  // Agrupamento por dia e cálculo de horas
  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: TimeEntry[] } = {}
    entries.forEach(entry => {
      const dateKey = new Date(entry.timestamp).toLocaleDateString('pt-BR')
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(entry)
    })
    
    // Sort keys descending
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('/')
      const [dayB, monthB, yearB] = b.split('/')
      const dateA = new Date(Number(yearA), Number(monthA) - 1, Number(dayA))
      const dateB = new Date(Number(yearB), Number(monthB) - 1, Number(dayB))
      return dateB.getTime() - dateA.getTime()
    })

    return sortedKeys.map(key => {
      const dayEntries = groups[key].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      // Calculate daily total
      let totalMs = 0
      let startMs: number | null = null
      
      for (const entry of dayEntries) {
        if (entry.type === 'ENTRADA') {
          startMs = new Date(entry.timestamp).getTime()
        } else if (entry.type === 'SAIDA' && startMs !== null) {
          totalMs += new Date(entry.timestamp).getTime() - startMs
          startMs = null
        }
      }

      // Format total hours
      const totalHours = Math.floor(totalMs / (1000 * 60 * 60))
      const totalMins = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
      
      return {
        date: key,
        entries: dayEntries,
        totalTimeFormatted: `${totalHours.toString().padStart(2, '0')}:${totalMins.toString().padStart(2, '0')}h`
      }
    })
  }, [entries])

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>
  }

  const allEntriesSorted = [...entries].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const lastEntry = allEntriesSorted[0]
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

      {/* Histórico e Filtros */}
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem' }}>Histórico de Pontos</h3>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setFilterType('all')} style={{ padding: '8px 16px', background: filterType === 'all' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)', color: filterType === 'all' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>Recentes</button>
            <button className="btn-secondary" onClick={() => setFilterType('3')} style={{ padding: '8px 16px', background: filterType === '3' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)', color: filterType === '3' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>3 dias</button>
            <button className="btn-secondary" onClick={() => setFilterType('7')} style={{ padding: '8px 16px', background: filterType === '7' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)', color: filterType === '7' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>7 dias</button>
            <button className="btn-secondary" onClick={() => setFilterType('15')} style={{ padding: '8px 16px', background: filterType === '15' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)', color: filterType === '15' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>15 dias</button>
            <button className="btn-secondary" onClick={() => setFilterType('30')} style={{ padding: '8px 16px', background: filterType === '30' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)', color: filterType === '30' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>30 dias</button>
            <button className="btn-secondary" onClick={() => setFilterType('custom')} style={{ padding: '8px 16px', background: filterType === 'custom' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)', color: filterType === 'custom' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>Período</button>
          </div>

          {filterType === 'custom' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
              />
              <span>até</span>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
        </div>
        
        {groupedEntries.length === 0 ? (
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhum registro encontrado neste período.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {groupedEntries.map((group) => (
              <div key={group.date} className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                  <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    {group.date}
                  </h4>
                  <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>
                    Total trabalhado: {group.totalTimeFormatted}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px' }}>
                  {group.entries.map((entry) => (
                    <div key={entry.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '15px',
                      borderRadius: '8px',
                      background: entry.type === 'ENTRADA' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid var(--glass-border)'
                    }}>
                       <span style={{ 
                        color: entry.type === 'ENTRADA' ? 'var(--success)' : 'var(--danger)',
                        background: entry.type === 'ENTRADA' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                      }}>
                        {entry.type}
                      </span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                        {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
