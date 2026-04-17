import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!userId) {
    return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
  }

  const whereClause: any = { userId }
  if (startDate || endDate) {
    whereClause.timestamp = {}
    if (startDate) whereClause.timestamp.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      whereClause.timestamp.lte = end
    }
  }

  try {
    const entries = await prisma.timeEntry.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
    })
    return NextResponse.json({ data: entries })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar pontos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { userId, type, timestamp } = body

    if (!userId || !type || !timestamp) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const entry = await prisma.timeEntry.create({
      data: {
        userId,
        type,
        timestamp: new Date(timestamp)
      }
    })

    return NextResponse.json({ data: entry }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar ponto' }, { status: 500 })
  }
}
