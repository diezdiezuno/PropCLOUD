'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Edición en el lugar: se envuelve un texto de la plantilla con <Editable> y,
// cuando un proveedor lo pone en modo edición, ese texto se vuelve editable
// sobre la propia página. Fuera de edición no dibuja nada — la plantilla se ve
// idéntica para el visitante.
//
// El proveedor es *controlado*: no guarda ni sabe de permisos, solo avisa qué
// cambió. El editor de /admin/paginas lo usa para renderizar la plantilla real
// y editarla en vivo, y el guardado sigue siendo el del formulario. Así hay un
// solo estado y un solo guardado, en vez de dos que se pisan.

type Ctx = { editando: boolean; set: (ruta: string, valor: string) => void }
const EdicionCtx = createContext<Ctx | null>(null)

export function EditableProvider({ editando, onChange, children }: {
  editando: boolean
  onChange: (ruta: string, valor: string) => void
  children: ReactNode
}) {
  return <EdicionCtx.Provider value={{ editando, set: onChange }}>{children}</EdicionCtx.Provider>
}

// Escribe `valor` en `obj` siguiendo una ruta con puntos ('work.paragraphs.0').
// Copia inmutable para que React vea el cambio. Si el tramo siguiente es un
// número crea un array, no un objeto — con un objeto `paragraphs` dejaría de
// ser lista y el .map() de la plantilla se rompería.
export function escribirRuta(obj: Record<string, unknown>, ruta: string, valor: string) {
  const claves = ruta.split('.')
  const out = JSON.parse(JSON.stringify(obj ?? {})) as Record<string, unknown>
  let cur = out
  for (let i = 0; i < claves.length - 1; i++) {
    const k = claves[i]
    if (typeof cur[k] !== 'object' || cur[k] === null) {
      cur[k] = /^\d+$/.test(claves[i + 1]) ? [] : {}
    }
    cur = cur[k] as Record<string, unknown>
  }
  cur[claves[claves.length - 1]] = valor
  return out
}

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
