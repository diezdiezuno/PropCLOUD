import { Suspense } from 'react'
import EmpresasClient from './EmpresasClient'

export default function EmpresasPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>}>
      <EmpresasClient />
    </Suspense>
  )
}
