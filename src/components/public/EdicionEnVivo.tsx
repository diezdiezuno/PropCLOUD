'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// Edición en vivo del contenido de las páginas: el admin ve el sitio como es y
// hace clic sobre un texto para cambiarlo.
//
// Por qué acá y no en el formulario del admin: ninguna de las dos oficinas
// tenía contenido cargado. No es olvido — obligar a ir a otra pantalla, buscar
// el campo y adivinar dónde cae en la página es suficiente fricción para que
// nadie lo haga.
//
// Solo textos. Las listas (estadísticas, pilares, posiciones) se siguen
// manejando en /admin/paginas, que ya resuelve agregar, quitar y ordenar.
//
// Nada de esto es seguridad: el botón se muestra según una consulta del cliente,
// pero quien guarda es la RLS de `tenant_config`. Un visitante que forzara el
// modo edición no podría escribir nada.

type Ctx = {
  editando: boolean
  set: (ruta: string, valor: string) => void
}
const EdicionCtx = createContext<Ctx | null>(null)

function escribir(obj: Record<string, unknown>, ruta: string, valor: string) {
  const claves = ruta.split('.')
  const out = JSON.parse(JSON.stringify(obj ?? {})) as Record<string, unknown>
  let cur = out
  for (let i = 0; i < claves.length - 1; i++) {
    const k = claves[i]
    // Si el tramo siguiente es un número, lo que falta es un array — con un
    // objeto, `work.paragraphs` dejaría de ser lista y el .map() se rompería.
    if (typeof cur[k] !== 'object' || cur[k] === null) {
      cur[k] = /^\d+$/.test(claves[i + 1]) ? [] : {}
    }
    cur = cur[k] as Record<string, unknown>
  }
  cur[claves[claves.length - 1]] = valor
  return out
}

export function EdicionProvider({ tenantId, slug, campo, inicial, children }: {
  tenantId: string
  slug: string
  campo: string                       // p.ej. 'nosotros_content'
  inicial?: Record<string, unknown>
  children: ReactNode
}) {
  const router = useRouter()
  const [esAdmin,   setEsAdmin]   = useState(false)
  const [editando,  setEditando]  = useState(false)
  const [borrador,  setBorrador]  = useState<Record<string, unknown>>(inicial ?? {})
  const [sucio,     setSucio]     = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg,       setMsg]       = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return
      sb.from('tenant_admins').select('user_id')
        .eq('user_id', data.user.id).eq('tenant_id', tenantId).maybeSingle()
        .then(({ data: a }) => setEsAdmin(!!a))
    })
  }, [tenantId])

  // Avisar antes de perder cambios sin guardar.
  useEffect(() => {
    if (!sucio) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sucio])

  function set(ruta: string, valor: string) {
    setBorrador(prev => escribir(prev, ruta, valor))
    setSucio(true)
    setMsg(null)
  }

  async function guardar() {
    setGuardando(true)
    setMsg(null)
    const sb = createClient()

    // Lectura-modificación-escritura del array entero: `pages_config` es un
    // jsonb con todas las páginas y no hay forma de tocar una sola desde acá.
    const { data, error } = await sb.from('tenant_config')
      .select('pages_config').eq('tenant_id', tenantId).single()
    if (error) { setMsg('No se pudo leer la configuración'); setGuardando(false); return }

    const paginas = [...((data.pages_config ?? []) as { slug?: string; settings?: Record<string, unknown> }[])]
    const i = paginas.findIndex(p => p.slug === slug)
    if (i === -1) { setMsg(`La página "${slug}" no está en la configuración`); setGuardando(false); return }
    paginas[i] = { ...paginas[i], settings: { ...(paginas[i].settings ?? {}), [campo]: borrador } }

    // El .select() no es adorno: un update que la RLS filtra devuelve 0 filas
    // sin error, y diría "guardado" sin haber escrito nada.
    const { data: upd, error: e2 } = await sb.from('tenant_config')
      .update({ pages_config: paginas }).eq('tenant_id', tenantId).select('tenant_id')
    setGuardando(false)
    if (e2)          { setMsg('Error: ' + e2.message); return }
    if (!upd?.length) { setMsg('No tenés permiso para editar este sitio'); return }

    setSucio(false)
    setMsg('Guardado ✓')
    router.refresh()
  }

  return (
    <EdicionCtx.Provider value={{ editando, set }}>
      {children}

      {esAdmin && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'system-ui, sans-serif' }}>
          {msg && (
            <span style={{ fontSize: 12.5, background: msg.startsWith('Guardado') ? '#0F7A3D' : '#C0392B', color: '#fff', padding: '7px 12px', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
              {msg}
            </span>
          )}

          {editando && (
            <button onClick={guardar} disabled={!sucio || guardando}
              style={{ height: 42, padding: '0 18px', borderRadius: 21, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: '#fff', background: sucio ? '#0F7A3D' : '#9ca3af', cursor: sucio && !guardando ? 'pointer' : 'default', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
              {guardando ? 'Guardando…' : sucio ? 'Guardar' : 'Sin cambios'}
            </button>
          )}

          <button
            onClick={() => {
              if (editando && sucio && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return
              setEditando(v => !v); setMsg(null)
              if (editando) { setBorrador(inicial ?? {}); setSucio(false); router.refresh() }
            }}
            style={{ height: 42, padding: '0 18px', borderRadius: 21, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: '#fff', background: editando ? '#5a6070' : '#111', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
            {editando ? 'Salir' : '✎ Editar página'}
          </button>
        </div>
      )}
    </EdicionCtx.Provider>
  )
}

// Envuelve un texto de la plantilla. Fuera del modo edición no dibuja nada
// propio —el sitio se ve idéntico para un visitante— y en modo edición vuelve
// el texto editable en el lugar donde está.
//
// El contenido no se re-renderiza mientras se escribe: React reemplazando el
// nodo movería el cursor al principio en cada tecla. Se lee al salir del campo.
export function Editable({ ruta, children, bloque = false }: {
  ruta: string
  children: ReactNode
  bloque?: boolean          // true para párrafos: ocupa el ancho, no se corta
}) {
  const ctx = useContext(EdicionCtx)
  if (!ctx?.editando) return <>{children}</>

  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={e => ctx.set(ruta, e.currentTarget.textContent?.trim() ?? '')}
      title={ruta}
      style={{
        display: bloque ? 'block' : 'inline-block',
        outline: '2px dashed rgba(107,47,160,.55)',
        outlineOffset: 3,
        borderRadius: 3,
        cursor: 'text',
        minWidth: 24,
        minHeight: '1em',
      }}
    >
      {children}
    </span>
  )
}
