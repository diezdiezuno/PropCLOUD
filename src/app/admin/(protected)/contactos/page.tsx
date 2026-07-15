import { Suspense } from 'react'
import ContactosClient from './ContactosClient'

export default function ContactosPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>}>
      <ContactosClient />
    </Suspense>
  )
}
