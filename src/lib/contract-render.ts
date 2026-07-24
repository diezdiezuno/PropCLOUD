// Motor de plantillas de contrato.
//
// El admin escribe el texto fijo del contrato y mete marcadores donde va un
// dato: "El precio pactado es {{propiedad.precio}}". Acá vive el catálogo de
// marcadores disponibles y el reemplazo. Un tipo de contrato nuevo no exige
// tocar código: se escribe la plantilla y ya.
//
// Decisión: si un marcador no tiene dato, se reemplaza por una marca visible
// («____») en vez de dejar el {{...}} crudo o un vacío silencioso. En un
// contrato, un campo en blanco que se nota es mucho mejor que uno que pasa
// desapercibido.

export interface DatosContrato {
  propiedad: {
    titulo: string | null; tipo: string | null; transaccion: string | null
    precio: number | null; moneda: string | null
    provincia: string | null; canton: string | null; distrito: string | null
    direccion: string | null
    finca: string | null; plano: string | null
    area_m2: number | null; lote_m2: number | null
    habitaciones: number | null; banos: number | null
  }
  contrato: {
    fecha_inicio: string | null; fecha_vencimiento: string | null
    duracion_meses: number | null
    comision_pct: number | null; comision_monto: number | null
    acuerdos: string | null
  }
  oficina: { nombre: string | null }
  agente:  { nombre: string | null; cedula: string | null; email: string | null; telefono: string | null; whatsapp: string | null }
  // Datos del/los propietario(s), ya unidos si hay más de uno.
  duenos:        string | null       // nombres
  dueno_cedula:  string | null
  dueno_email:   string | null
  dueno_whatsapp: string | null
}

/** Lo que el admin ve como ayuda al escribir la plantilla. */
export const VARIABLES: { grupo: string; items: { clave: string; label: string }[] }[] = [
  { grupo: 'Propiedad', items: [
    { clave: 'propiedad.titulo',       label: 'Título' },
    { clave: 'propiedad.tipo',         label: 'Tipo (casa, lote…)' },
    { clave: 'propiedad.transaccion',  label: 'Venta / alquiler' },
    { clave: 'propiedad.precio',       label: 'Precio con moneda' },
    { clave: 'propiedad.direccion',    label: 'Dirección exacta' },
    { clave: 'propiedad.ubicacion',    label: 'Distrito, cantón, provincia' },
    { clave: 'propiedad.distrito',     label: 'Distrito' },
    { clave: 'propiedad.canton',       label: 'Cantón' },
    { clave: 'propiedad.provincia',    label: 'Provincia' },
    { clave: 'propiedad.finca',        label: 'Número de finca' },
    { clave: 'propiedad.plano',        label: 'Número de plano' },
    { clave: 'propiedad.area_m2',      label: 'Área construida (m²)' },
    { clave: 'propiedad.lote_m2',      label: 'Área del terreno (m²)' },
    { clave: 'propiedad.habitaciones', label: 'Habitaciones' },
    { clave: 'propiedad.banos',        label: 'Baños' },
  ]},
  { grupo: 'Contrato', items: [
    { clave: 'contrato.fecha_firma',       label: 'Fecha de firma' },
    { clave: 'contrato.duracion',          label: 'Duración (meses)' },
    { clave: 'contrato.fecha_vencimiento', label: 'Fecha de vencimiento' },
    { clave: 'contrato.comision',          label: 'Comisión (%)' },
    { clave: 'contrato.acuerdos',          label: 'Acuerdos adicionales' },
    { clave: 'contrato.hoy',               label: 'Fecha de hoy' },
  ]},
  { grupo: 'Personas', items: [
    { clave: 'duenos',           label: 'Propietario(s)' },
    { clave: 'dueno.cedula',     label: 'Cédula del dueño' },
    { clave: 'dueno.email',      label: 'Email del dueño' },
    { clave: 'dueno.whatsapp',   label: 'WhatsApp del dueño' },
    { clave: 'agente.nombre',    label: 'Agente' },
    { clave: 'agente.cedula',    label: 'Cédula del agente' },
    { clave: 'agente.email',     label: 'Email del agente' },
    { clave: 'agente.telefono',  label: 'Teléfono del agente' },
    { clave: 'agente.whatsapp',  label: 'WhatsApp del agente' },
    { clave: 'oficina.nombre',   label: 'Nombre de la oficina' },
  ]},
]

const FALTA = '____________'

function dinero(monto: number | null | undefined, moneda: string | null | undefined) {
  if (monto == null || monto === 0) return null
  const simbolo = moneda === 'CRC' ? '₡' : '$'
  // Sin locale explícito, igual que money() en la ficha de la propiedad: el
  // contrato no puede mostrar el precio distinto de donde se cargó ('es-CR'
  // separa miles con espacio y quedaba $150 000 contra $150,000).
  return `${simbolo}${Math.round(monto).toLocaleString()}`
}

function fecha(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-CR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

/** Resuelve cada marcador a su texto. null = no hay dato. */
function valores(d: DatosContrato): Record<string, string | null> {
  const p = d.propiedad, c = d.contrato
  const ubicacion = [p.distrito, p.canton, p.provincia].filter(Boolean).join(', ') || null
  // Solo el porcentaje en el contrato (sin el monto entre paréntesis). Si la
  // comisión se pactó como monto fijo sin %, cae al monto para no quedar vacío.
  const comision = c.comision_pct ? `${c.comision_pct}%` : dinero(c.comision_monto, p.moneda)
  return {
    'propiedad.titulo':       p.titulo,
    'propiedad.tipo':         p.tipo,
    'propiedad.transaccion':  p.transaccion === 'rent' ? 'alquiler'
                            : p.transaccion === 'sale_rent' ? 'venta y alquiler' : 'venta',
    'propiedad.precio':       dinero(p.precio, p.moneda),
    'propiedad.direccion':    p.direccion,
    'propiedad.ubicacion':    ubicacion,
    'propiedad.distrito':     p.distrito,
    'propiedad.canton':       p.canton,
    'propiedad.provincia':    p.provincia,
    'propiedad.finca':        p.finca,
    'propiedad.plano':        p.plano,
    'propiedad.area_m2':      p.area_m2 != null ? String(p.area_m2) : null,
    'propiedad.lote_m2':      p.lote_m2 != null ? String(p.lote_m2) : null,
    'propiedad.habitaciones': p.habitaciones != null ? String(p.habitaciones) : null,
    'propiedad.banos':        p.banos != null ? String(p.banos) : null,
    'contrato.fecha_inicio':      fecha(c.fecha_inicio),   // alias viejo = fecha de firma
    'contrato.fecha_firma':       fecha(c.fecha_inicio),
    'contrato.duracion':          c.duracion_meses ? `${c.duracion_meses} ${c.duracion_meses === 1 ? 'mes' : 'meses'}` : null,
    'contrato.fecha_vencimiento': fecha(c.fecha_vencimiento),
    'contrato.comision':          comision,
    'contrato.acuerdos':          c.acuerdos,
    'contrato.hoy':               new Date().toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }),
    'duenos':          d.duenos,
    'dueno.cedula':    d.dueno_cedula,
    'dueno.email':     d.dueno_email,
    'dueno.whatsapp':  d.dueno_whatsapp,
    'agente.nombre':   d.agente.nombre,
    'agente.cedula':   d.agente.cedula,
    'agente.email':    d.agente.email,
    'agente.telefono': d.agente.telefono,
    'agente.whatsapp': d.agente.whatsapp,
    'oficina.nombre':  d.oficina.nombre,
  }
}

/**
 * Reemplaza los {{marcadores}} del cuerpo. Tolera espacios ({{ x }}) y no
 * rompe si el marcador no existe: lo deja marcado para que se vea al revisar.
 */
export function renderContrato(cuerpo: string, datos: DatosContrato): string {
  const v = valores(datos)
  return cuerpo.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, clave: string) =>
    clave in v ? (v[clave] ?? FALTA) : `[[${clave}?]]`)
}

/** Marcadores usados en el cuerpo que no existen en el catálogo. */
export function variablesDesconocidas(cuerpo: string): string[] {
  const validas = new Set(VARIABLES.flatMap(g => g.items.map(i => i.clave)))
  const usadas = [...cuerpo.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1])
  return [...new Set(usadas.filter(u => !validas.has(u)))]
}
