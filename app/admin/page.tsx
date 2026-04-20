'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  role: string
  weeklyHours: number
  profilePic?: string
}

interface TimeEntry {
  id: string
  type: string
  timestamp: string
  userId: string
}

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingUser, setViewingUser] = useState<User | null>(null)
  const [userEntries, setUserEntries] = useState<TimeEntry[]>([])
  
  // Filtros
  const [filterType, setFilterType] = useState<string>('all') // 'all', '3', '7', '15', '30', 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Modais
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User> & { password?: string } | null>(null)
  const [isPointModalOpen, setIsPointModalOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<{ id?: string, type: string, timestamp: string } | null>(null)
  
  // Confirmação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{ message: string, onConfirm: () => void } | null>(null)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          router.push('/login')
          return
        }
        const data = await res.json()
        if (data.user.role !== 'ADMIN') {
          router.push('/dashboard')
          return
        }
        setCurrentUser(data.user)
        fetchUsers()
      } catch (err) {
        console.error(err)
        router.push('/login')
      }
    }
    checkAdmin()
  }, [router])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = async (user: User) => {
    setViewingUser(user)
    fetchUserPoints(user.id)
  }

  const fetchUserPoints = async (userId: string) => {
    try {
      const queryParams = new URLSearchParams({ userId })
      
      if (filterType !== 'all' && filterType !== 'custom') {
        const days = parseInt(filterType, 10)
        const start = new Date()
        start.setDate(start.getDate() - days)
        start.setHours(0, 0, 0, 0)
        queryParams.append('startDate', start.toISOString())
      } else if (filterType === 'custom') {
        if (customStartDate) queryParams.append('startDate', new Date(customStartDate).toISOString())
        if (customEndDate) queryParams.append('endDate', new Date(customEndDate).toISOString())
      }

      const res = await fetch(`/api/admin/pontos?${queryParams.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setUserEntries(data.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (viewingUser) {
      fetchUserPoints(viewingUser.id)
    }
  }, [filterType, customStartDate, customEndDate])

  const handleCreateUser = () => {
    setEditingUser({ name: '', email: '', password: '', role: 'USER', weeklyHours: 44 })
    setIsUserModalOpen(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const method = editingUser.id ? 'PUT' : 'POST'
    const url = editingUser.id ? `/api/admin/users/${editingUser.id}` : '/api/admin/users'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      })
      if (res.ok) {
        setIsUserModalOpen(false)
        setEditingUser(null)
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar usuário')
      }
    } catch (err) {
      alert('Erro de conexão')
    }
  }

  const handleDeleteUser = (userId: string) => {
    setConfirmConfig({
      message: 'Tem certeza que deseja deletar este usuário e todos os seus pontos? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
          if (res.ok) {
            fetchUsers()
            if (viewingUser?.id === userId) setViewingUser(null)
          }
        } catch (err) {
          alert('Erro ao deletar')
        }
        setIsConfirmModalOpen(false)
      }
    })
    setIsConfirmModalOpen(true)
  }

  // Ponto Management
  const handleAddPoint = () => {
    const now = new Date()
    // format as YYYY-MM-DDTHH:MM local
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
    setEditingPoint({ type: 'ENTRADA', timestamp: localNow })
    setIsPointModalOpen(true)
  }

  const handleEditPoint = (ponto: TimeEntry) => {
    const date = new Date(ponto.timestamp)
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
    setEditingPoint({ id: ponto.id, type: ponto.type, timestamp: localDate })
    setIsPointModalOpen(true)
  }

  const handleSavePoint = async () => {
    if (!editingPoint || !viewingUser) return
    
    // Validar ponto futuro
    const selectedDate = new Date(editingPoint.timestamp)
    const now = new Date()
    if (selectedDate > now) {
      alert('Não é permitido registrar pontos em horários futuros.')
      return
    }

    const method = editingPoint.id ? 'PUT' : 'POST'
    const url = editingPoint.id ? `/api/admin/pontos/${editingPoint.id}` : `/api/admin/pontos`
    
    // Para resolver o problema da hora errada, vamos garantir que enviamos um ISO string correto
    // O datetime-local usa o fuso local, então 'new Date(editingPoint.timestamp)' irá usar o fuso do navegador.
    const body = { 
      ...editingPoint, 
      timestamp: selectedDate.toISOString(), // Envia como UTC para o servidor
      userId: viewingUser.id 
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setIsPointModalOpen(false)
        handleSelectUser(viewingUser)
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar ponto')
      }
    } catch (err) {
      alert('Erro ao salvar ponto')
    }
  }

  const handleDeletePoint = (id: string) => {
    setConfirmConfig({
      message: 'Tem certeza que deseja deletar este registro de ponto?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/pontos/${id}`, { method: 'DELETE' })
          if (res.ok && viewingUser) {
            handleSelectUser(viewingUser)
          }
        } catch (err) {
          alert('Erro ao deletar ponto')
        }
        setIsConfirmModalOpen(false)
      }
    })
    setIsConfirmModalOpen(true)
  }

  // Agrupamento por dia (Mesma lógica da Dashboard)
  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: TimeEntry[] } = {}
    userEntries.forEach(entry => {
      const dateKey = new Date(entry.timestamp).toLocaleDateString('pt-BR')
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(entry)
    })
    
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
  }, [userEntries])

  // Cálculo total no período filtrado
  const totalWorked = useMemo(() => {
    let totalMs = 0
    groupedEntries.forEach(group => {
      const match = group.totalTimeFormatted.match(/(\d+):(\d+)h/)
      if (match) {
        totalMs += (parseInt(match[1]) * 3600000) + (parseInt(match[2]) * 60000)
      }
    })
    const h = Math.floor(totalMs / 3600000)
    const m = Math.floor((totalMs % 3600000) / 60000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}h`
  }, [groupedEntries])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Carregando Portal Admin...</div>

  const maxDateTime = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)

  return (
    <div className="admin-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Painel Administrativo</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestão de Funcionários e Carga Horária</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/dashboard')} className="btn-secondary" style={{ width: 'auto', padding: '10px 20px' }}>Dashboard</button>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Sair</button>
        </div>
      </div>

      <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
        
        {/* Lista de Usuários */}
        <div className="glass-panel" style={{ padding: '20px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Funcionários</h3>
            <button onClick={handleCreateUser} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map(u => (
              <div 
                key={u.id} 
                onClick={() => handleSelectUser(u)}
                style={{ 
                  padding: '12px', 
                  borderRadius: '10px', 
                  background: viewingUser?.id === u.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  border: viewingUser?.id === u.id ? '1px solid var(--accent-color)' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.role} • {u.weeklyHours}h/sem</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }} style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6 }}>🗑️</button>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes do Usuário Selecionado */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          {viewingUser ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{viewingUser.name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{viewingUser.email}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{totalWorked}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trabalhadas no Período</div>
                </div>
              </div>

              {/* Filtros de Histórico */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
                  {['all', '3', '7', '15', '30', 'custom'].map(type => (
                    <button 
                      key={type}
                      className="btn-secondary" 
                      onClick={() => setFilterType(type)} 
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.75rem',
                        background: filterType === type ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)', 
                        color: filterType === type ? '#fff' : 'var(--text-secondary)', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: 'pointer' 
                      }}
                    >
                      {type === 'all' ? 'Tudo' : type === 'custom' ? 'Período' : `${type} dias`}
                    </button>
                  ))}
                </div>

                {filterType === 'custom' && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
                    <input 
                      type="date" 
                      value={customStartDate} 
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '8px', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.8rem' }}>até</span>
                    <input 
                      type="date" 
                      value={customEndDate} 
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '8px', fontSize: '0.8rem' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Histórico Registrado</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleAddPoint} style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>+ Add Ponto</button>
                  <button onClick={() => { setEditingUser(viewingUser); setIsUserModalOpen(true); }} className="btn-secondary" style={{ width: 'auto', padding: '6px 15px', fontSize: '0.8rem' }}>Perfil</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {groupedEntries.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.1)', borderRadius: '10px' }}>Nenhum ponto encontrado.</div>
                ) : (
                  groupedEntries.map(group => (
                    <div key={group.date} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '15px', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{group.date}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>{group.totalTimeFormatted}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.entries.map(e => (
                          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span style={{ color: e.type === 'ENTRADA' ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.7rem' }}>{e.type}</span>
                              <span style={{ fontSize: '0.9rem' }}>{new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => handleEditPoint(e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                              <button onClick={() => handleDeletePoint(e.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>👥</div>
              <p>Selecione um funcionário</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .admin-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-container {
            padding: 10px !important;
          }
        }
      `}</style>

      {/* Modal de Confirmação de Exclusão */}
      {isConfirmModalOpen && confirmConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
            <h3 style={{ marginBottom: '15px' }}>Confirmar Exclusão</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', lineHeight: '1.5' }}>{confirmConfig.message}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsConfirmModalOpen(false)} style={{ flex: 1, padding: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmConfig.onConfirm} className="btn-primary" style={{ flex: 1, background: 'var(--danger)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ponto */}
      {isPointModalOpen && editingPoint && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px', background: 'var(--bg-secondary)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{editingPoint.id ? 'Editar Ponto' : 'Novo Ponto'}</h2>
              <button 
                onClick={() => setIsPointModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '5px' }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tipo de Ponto</label>
              <select className="input-field" value={editingPoint.type} onChange={e => setEditingPoint({...editingPoint, type: e.target.value})}>
                <option value="ENTRADA">ENTRADA</option>
                <option value="SAIDA">SAÍDA</option>
              </select>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Data e Horário</label>
              <input 
                type="datetime-local" 
                className="input-field" 
                value={editingPoint.timestamp} 
                max={maxDateTime}
                onChange={e => setEditingPoint({...editingPoint, timestamp: e.target.value})} 
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setIsPointModalOpen(false)} style={{ flex: 1, padding: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSavePoint} className="btn-primary" style={{ flex: 1 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação/Edição de Usuário */}
      {isUserModalOpen && editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px', background: 'var(--bg-secondary)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{editingUser.id ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
              <button 
                onClick={() => setIsUserModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '5px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="Nome Completo" className="input-field" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} required />
              <input type="email" placeholder="E-mail" className="input-field" value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} required />
              <input type="password" placeholder={editingUser.id ? "Senha (deixe vazio p/ não mudar)" : "Senha Inicial"} className="input-field" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} required={!editingUser.id} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <select className="input-field" value={editingUser.role || 'USER'} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                  <option value="USER">Usuário Comum</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                <input type="number" placeholder="Horas Semanais" className="input-field" value={editingUser.weeklyHours || 44} onChange={e => setEditingUser({...editingUser, weeklyHours: parseFloat(e.target.value)})} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsUserModalOpen(false)} style={{ flex: 1, padding: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
