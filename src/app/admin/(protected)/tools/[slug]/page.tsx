'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/admin/PageHeader'

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

// Tabs internos de Administración, cada uno es un link del menú (?tab=)
const ADMIN_TABS: Record<string, { title: string; subtitle: string }> = {
  agentes:    { title: 'Agentes',            subtitle: 'Gestión de agentes e invitaciones.' },
  equipos:    { title: 'Equipos de oficina', subtitle: 'Inventario de equipos de la oficina.' },
  calendario: { title: 'Calendario',         subtitle: 'Calendarios de la oficina.' },
  materiales: { title: 'Materiales',         subtitle: 'Materiales guardados de los agentes.' },
}

function ToolFrame() {
  const { slug } = useParams<{ slug: string }>()
  const search = useSearchParams()
  const tool = TOOLS[slug]

  if (!tool) {
    return <div style={{ padding: 40, color: '#e53e3e', fontSize: 14 }}>Herramienta no encontrada.</div>
  }

  // Deep-link: ?id=X carga un guardado; ?tab=X abre un tab de Administración.
  const id = search.get('id')
  const tab = slug === 'admin' ? search.get('tab') : null
  const heading = (tab && ADMIN_TABS[tab]) ? ADMIN_TABS[tab] : tool
  const qs = new URLSearchParams({ embed: '1' })
  if (id) qs.set('id', id)
  if (tab) qs.set('tab', tab)

  // La herramienta reporta su altura de contenido (postMessage) → el iframe
  // crece y scrollea la página, sin caja/scroll interno.
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.source === iframeRef.current?.contentWindow && typeof e.data?.ptHeight === 'number') {
        setHeight(e.data.ptHeight)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  useEffect(() => { setHeight(null) }, [tab, slug])

  return (
    <>
      <PageHeader title={<>{heading.title}</>} subtitle={<>{heading.subtitle}</>} />
      <iframe
        ref={iframeRef}
        key={tab ?? 'default'}
        src={`/tools/${slug}/?${qs.toString()}`}
        scrolling="no"
        style={{
          width: '100%',
          height: height ? `${height}px` : 'calc(100vh - 160px)',
          border: 'none',
          background: 'transparent',
          display: 'block',
          overflow: 'hidden',
        }}
        title={`PropTools — ${heading.title}`}
      />
    </>
  )
}

export default function ToolPage() {
  // useSearchParams exige Suspense en build estático
  return <Suspense fallback={null}><ToolFrame /></Suspense>
}
