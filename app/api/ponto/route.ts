import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const userId = await getUserFromSession()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    // Busca o último ponto batido para alternar automaticamente
    const lastEntry = await prisma.timeEntry.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    })

    let nextType = 'ENTRADA'
    if (lastEntry && lastEntry.type === 'ENTRADA') {
      nextType = 'SAIDA'
    }

    // O horário do servidor é considerado para segurança
    const newEntry = await prisma.timeEntry.create({
      data: {
        userId,
        type: nextType,
      },
    })

    return NextResponse.json({ message: 'Ponto registrado.', data: newEntry }, { status: 201 })
  } catch (error) {
    console.error('Error in ponto POST:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const userId = await getUserFromSession()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    // Busca os registros de forma decrescente
    const entries = await prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    return NextResponse.json({ data: entries })
  } catch (error) {
    console.error('Error in ponto GET:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
