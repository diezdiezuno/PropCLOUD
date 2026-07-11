'use client'

import { useParams } from 'next/navigation'

// Herramientas PropTools embebidas dentro del shell de PropCLOUD.
// La sesión se comparte vía cookie (public/tools/cookie-storage.js).
const VALID = new Set(['firmas', 'tarjetas', 'rotulos', 'valoraciones', 'calendario', 'equipos', 'perfil', 'admin'])

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>()

  if (!VALID.has(slug)) {
    return <div style={{ padding: 40, color: '#e53e3e', fontSize: 14 }}>Herramienta no encontrada.</div>
  }

  return (
    <iframe
      src={`/tools/${slug}/?embed=1`}
      style={{
        width: '100%',
        height: 'calc(100vh - 54px - 72px)',
        border: 'none',
        borderRadius: 12,
        background: '#fff',
        display: 'block',
      }}
      title={`PropTools — ${slug}`}
    />
  )
}
