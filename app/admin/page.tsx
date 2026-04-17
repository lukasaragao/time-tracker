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
    try {
      const res = await fetch(`/api/admin/pontos?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setUserEntries(data.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

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
    // format as YYYY-MM-DDTHH:MM
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
    const method = editingPoint.id ? 'PUT' : 'POST'
    const url = editingPoint.id ? `/api/admin/pontos/${editingPoint.id}` : `/api/admin/pontos`
    const body = { ...editingPoint, userId: viewingUser.id }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setIsPointModalOpen(false)
        handleSelectUser(viewingUser)
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

  // Cálculo de horas trabalhadas no período para o usuário selecionado
  const totalWorked = useMemo(() => {
    if (!userEntries.length) return "00:00h"
    
    // Simplificado: ordena e calcula pares
    const sorted = [...userEntries].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    let ms = 0
    let lastIn: number | null = null
    
    sorted.forEach(e => {
      if (e.type === 'ENTRADA') lastIn = new Date(e.timestamp).getTime()
      else if (e.type === 'SAIDA' && lastIn) {
        ms += new Date(e.timestamp).getTime() - lastIn
        lastIn = null
      }
    })

    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}h`
  }, [userEntries])

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Carregando Portal Admin...</div>

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Painel Administrativo</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestão de Funcionários e Carga Horária</p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary" style={{ width: 'auto', padding: '10px 20px' }}>Ir para Minha Dashboard</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        
        {/* Lista de Usuários */}
        <div className="glass-panel" style={{ padding: '20px' }}>
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
        <div className="glass-panel" style={{ padding: '30px' }}>
          {viewingUser ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{viewingUser.name}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{viewingUser.email}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{totalWorked}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trabalhadas no Período</div>
                </div>
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Registros de Pontos</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleAddPoint} style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>+ Add Ponto</button>
                  <button onClick={() => { setEditingUser(viewingUser); setIsUserModalOpen(true); }} className="btn-secondary" style={{ width: 'auto', padding: '6px 15px', fontSize: '0.8rem' }}>Editar Perfil</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userEntries.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.1)', borderRadius: '10px' }}>Nenhum ponto registrado.</div>
                ) : (
                  userEntries.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                      <div>
                        <span style={{ color: e.type === 'ENTRADA' ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.8rem', marginRight: '15px' }}>{e.type}</span>
                        <span style={{ fontWeight: 500 }}>{new Date(e.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleEditPoint(e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>✏️</button>
                        <button onClick={() => handleDeletePoint(e.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>👥</div>
              <p>Selecione um funcionário para ver detalhes</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {isConfirmModalOpen && confirmConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px', background: 'var(--bg-secondary)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{editingPoint.id ? 'Editar Ponto' : 'Novo Ponto'}</h2>
              <button 
                onClick={() => setIsPointModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '5px' }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select className="input-field" value={editingPoint.type} onChange={e => setEditingPoint({...editingPoint, type: e.target.value})}>
                <option value="ENTRADA">ENTRADA</option>
                <option value="SAIDA">SAÍDA</option>
              </select>
              <input 
                type="datetime-local" 
                className="input-field" 
                value={editingPoint.timestamp} 
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px', background: 'var(--bg-secondary)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{editingUser.id ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
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
