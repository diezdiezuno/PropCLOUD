import { Suspense } from 'react'
import ClientesClient from './ClientesClient'

export default function ClientesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>}>
      <ClientesClient />
    </Suspense>
  )
}
