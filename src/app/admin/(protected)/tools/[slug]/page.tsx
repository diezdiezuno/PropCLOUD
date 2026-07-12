'use client'

import { useParams } from 'next/navigation'

// Herramientas PropTools embebidas dentro del shell de PropCLOUD.
// La sesión se comparte vía cookie (public/tools/cookie-storage.js).
// El título estilo CRM lo pone esta página; la herramienta oculta el suyo
// en modo embebido (ver public/tools/components.js).
const TOOLS: Record<string, { title: string; subtitle: string }> = {
  firmas:       { title: 'Firmas',        subtitle: 'Generá tu firma de correo.' },
  tarjetas:     { title: 'Tarjetas',      subtitle: 'Tarjetas de presentación digitales.' },
  rotulos:      { title: 'Rótulos',       subtitle: 'Rótulos para propiedades.' },
  valoraciones: { title: 'Valoraciones',  subtitle: 'Avalúos de propiedades.' },
  calendario:   { title: 'Calendario',    subtitle: 'Tus eventos y los calendarios de la oficina.' },
  equipos:      { title: 'Equipos',       subtitle: 'Reservá equipos de la oficina.' },
  perfil:       { title: 'Mi perfil',     subtitle: 'Tu información de agente — se usa en firmas, tarjetas, rótulos, CRM y web.' },
  admin:        { title: 'Administración PropTools', subtitle: 'Gestión de agentes, invitaciones y equipos de oficina.' },
}

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>()
  const tool = TOOLS[slug]

  if (!tool) {
    return <div style={{ padding: 40, color: '#e53e3e', fontSize: 14 }}>Herramienta no encontrada.</div>
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{tool.title}</h1>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>{tool.subtitle}</p>
      </div>
      <iframe
        src={`/tools/${slug}/?embed=1`}
        style={{
          width: '100%',
          height: 'calc(100vh - 190px)',
          border: 'none',
          background: 'transparent',
          display: 'block',
        }}
        title={`PropTools — ${tool.title}`}
      />
    </>
  )
}
