import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nenhum campo pode estar vazio.' }, { status: 400 })
    }

    const userCount = await prisma.user.count()

    if (userCount > 0) {
      return NextResponse.json({ error: 'Cadastro bloqueado. Apenas o administrador pode criar novas contas.' }, { status: 403 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'E-mail já está em uso.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN', // The first user is the ADMIN
      },
    })

    await createSession(user.id)

    return NextResponse.json({ message: 'Conta de Administrador criada com sucesso!' }, { status: 201 })
  } catch (error) {
    console.error('Error in registro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
