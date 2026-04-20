import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

export async function PUT(request: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { pontoId } = await context.params

  try {
    const body = await request.json()
    const { type, timestamp } = body

    let entryDate: Date | undefined = undefined
    if (timestamp) {
      entryDate = new Date(timestamp)
      if (entryDate > new Date()) {
        return NextResponse.json({ error: 'Não é permitido registrar pontos em horários futuros' }, { status: 400 })
      }
    }

    const entry = await prisma.timeEntry.update({
      where: { id: pontoId },
      data: {
        type,
        timestamp: entryDate
      }
    })

    return NextResponse.json({ data: entry })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar ponto' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { pontoId } = await context.params

  try {
    await prisma.timeEntry.delete({
      where: { id: pontoId }
    })
    return NextResponse.json({ message: 'Ponto deletado' })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar ponto' }, { status: 500 })
  }
}
