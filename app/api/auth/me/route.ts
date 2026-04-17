import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const userId = await getUserFromSession()
    if (!userId) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, name: true, email: true, 
        profilePic: true, country: true, state: true, 
        city: true, zipcode: true, street: true, number: true,
        role: true, weeklyHours: true
      },
    })

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getUserFromSession()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, password, profilePic, country, state, city, zipcode, street, number } = body

    const updateData: any = {
      name, email, profilePic, country, state, city, zipcode, street, number
    }

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Check email availability if changed
    const currentUser = await prisma.user.findUnique({ where: { id: userId } })
    if (email !== currentUser?.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } })
      if (existingEmail) {
        return NextResponse.json({ error: 'E-mail indisponível.' }, { status: 400 })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, name: true, email: true,
        profilePic: true, country: true, state: true,
        city: true, zipcode: true, street: true, number: true,
        role: true, weeklyHours: true
      }
    })

    return NextResponse.json({ user: updatedUser, message: 'Perfil atualizado.' })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
