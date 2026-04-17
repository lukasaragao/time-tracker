'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  profilePic?: string
  country?: string
  state?: string
  city?: string
  zipcode?: string
  street?: string
  number?: string
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
  const [theme, setTheme] = useState<string>('system')

  // Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [configData, setConfigData] = useState<Partial<User> & { password?: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  // Initialize theme 
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'system'
    setTheme(savedTheme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      }
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme)
    if (newTheme === 'system') {
      localStorage.removeItem('theme')
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    } else {
      localStorage.setItem('theme', newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

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

  const handleCepBlur = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setConfigData(prev => ({
            ...prev,
            street: data.logradouro,
            city: data.localidade,
            state: data.uf,
            country: prev.country || 'Brasil'
          }))
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e)
      }
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setIsConfigOpen(false)
        setConfigData({})
      } else {
        alert(data.error || 'Erro ao atualizar configurações')
      }
    } catch (e) {
      alert('Erro inesperado')
    } finally {
      setIsSaving(false)
    }
  }

  const openConfig = () => {
    if (user) {
      setConfigData({
        name: user.name,
        email: user.email,
        profilePic: user.profilePic || '',
        country: user.country || '',
        state: user.state || '',
        city: user.city || '',
        zipcode: user.zipcode || '',
        street: user.street || '',
        number: user.number || ''
      })
      setIsConfigOpen(true)
    }
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
    <div style={{ flex: 1, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      
      {/* Navbar Superior */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
        
        <div 
          onClick={openConfig} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px', 
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            transition: 'all 0.2s'
          }}
          className="hover:scale-105"
        >
          {user?.profilePic ? (
            <img src={user.profilePic} alt="Perfil" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
              {user?.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Olá, {user?.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.email}</p>
          </div>
          <span style={{ marginLeft: '10px', fontSize: '1.2rem', opacity: 0.5 }}>⚙️</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
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

      {/* Configurações (Settings Modal) */}
      {isConfigOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', background: 'var(--bg-secondary)', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Configurações da Conta</h2>
              <button onClick={() => setIsConfigOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {/* Mudança de Tema por Ícones */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '30px', padding: '15px', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontWeight: 600 }}>Tema:</div>
              <button onClick={() => changeTheme('light')} style={{ background: theme === 'light' ? 'var(--accent-color)' : 'transparent', color: theme === 'light' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', transition: 'all 0.2s' }} title="Claro">
                ☀️
              </button>
              <button onClick={() => changeTheme('dark')} style={{ background: theme === 'dark' ? 'var(--accent-color)' : 'transparent', color: theme === 'dark' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', transition: 'all 0.2s' }} title="Escuro">
                🌙
              </button>
              <button onClick={() => changeTheme('system')} style={{ background: theme === 'system' ? 'var(--accent-color)' : 'transparent', color: theme === 'system' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', transition: 'all 0.2s' }} title="Automático">
                💻
              </button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nome</label>
                  <input type="text" className="input-field" value={configData.name || ''} onChange={(e) => setConfigData({...configData, name: e.target.value})} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>E-mail</label>
                  <input type="email" className="input-field" value={configData.email || ''} onChange={(e) => setConfigData({...configData, email: e.target.value})} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nova Senha</label>
                  <input type="password" placeholder="Deixe em branco p/ não alterar" className="input-field" value={configData.password || ''} onChange={(e) => setConfigData({...configData, password: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Url Foto de Perfil</label>
                  <input type="text" placeholder="https://..." className="input-field" value={configData.profilePic || ''} onChange={(e) => setConfigData({...configData, profilePic: e.target.value})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.2rem', marginTop: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>Endereço</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>CEP</label>
                  <input type="text" className="input-field" placeholder="00000-000" value={configData.zipcode || ''} onChange={(e) => setConfigData({...configData, zipcode: e.target.value})} onBlur={(e) => handleCepBlur(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>País</label>
                  <input type="text" className="input-field" value={configData.country || ''} onChange={(e) => setConfigData({...configData, country: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Cidade</label>
                  <input type="text" className="input-field" value={configData.city || ''} onChange={(e) => setConfigData({...configData, city: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Estado</label>
                  <input type="text" className="input-field" value={configData.state || ''} onChange={(e) => setConfigData({...configData, state: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Rua</label>
                  <input type="text" className="input-field" value={configData.street || ''} onChange={(e) => setConfigData({...configData, street: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Número</label>
                  <input type="text" className="input-field" value={configData.number || ''} onChange={(e) => setConfigData({...configData, number: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '10px' }}>
                <button type="button" onClick={() => setIsConfigOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
