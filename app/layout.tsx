import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Time Tracker | Fluxo de Estudo',
  description: 'Controle sua jornada de trabalho com modernidade e eficiência.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
