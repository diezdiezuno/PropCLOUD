import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PropCLOUD',
  description: 'Plataforma inmobiliaria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
