import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export async function POST() {
  try {
    await deleteSession()
    return NextResponse.json({ message: 'Desconectado com sucesso.' })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deslogar.' }, { status: 500 })
  }
}
