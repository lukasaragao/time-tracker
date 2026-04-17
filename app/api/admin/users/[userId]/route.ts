import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET(request: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { userId } = await context.params

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, weeklyHours: true,
        profilePic: true, country: true, state: true, city: true,
        zipcode: true, street: true, number: true
      }
    })
    return NextResponse.json({ data: user })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { userId } = await context.params

  try {
    const body = await request.json()
    const { name, email, password, role, weeklyHours, country, state, city, zipcode, street, number } = body

    const updateData: any = {
      name, email, role, 
      weeklyHours: weeklyHours ? parseFloat(weeklyHours) : undefined,
      country, state, city, zipcode, street, number
    }

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { userId } = await context.params

  try {
    // Delete entries first or let Cascade handle if defined (prisma schema doesn't have cascade defined but pg might)
    // Actually we should delete time entries
    await prisma.timeEntry.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ message: 'Usuário deletado' })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar usuário' }, { status: 500 })
  }
}
