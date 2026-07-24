'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'
import { getCantons, getDistricts } from '@/data/cr-divisions'
import type mapboxgl from 'mapbox-gl'
import ContactVCardModal, { type VCardViewType } from '../ContactVCardModal'
import { Icon } from '@/lib/icons'
import NewOwnerModal, { type NewOwnerResult } from '../NewOwnerModal'
import { renderContrato, type DatosContrato } from '@/lib/contract-render'
import { imprimirContrato } from '@/lib/contract-pdf'
import { phoneDisplay } from '@/lib/phone'

/* ── Constants ───────────────────────────────────────────────── */
const PROVINCIAS   = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']
const TRANSACTIONS = [{ value: 'sale', label: 'Venta' }, { value: 'rent', label: 'Alquiler' }, { value: 'sale_rent', label: 'Venta y alquiler' }]
// Fallback si el tenant no tiene estados en la tabla property_statuses todavía
// (antes de correr la migración property-taxonomies.sql). web_status = mapeo
// histórico: active→active, sold→sold, resto→inactive.
interface CrmStatus { value: string; label: string; web_status: string }
const CRM_STATUSES_FALLBACK: CrmStatus[] = [
  { value: 'draft',       label: 'Borrador',              web_status: 'inactive' },
  { value: 'captacion',   label: 'En captación',          web_status: 'inactive' },
  { value: 'preparacion', label: 'En preparación',        web_status: 'inactive' },
  { value: 'lista',       label: 'Lista para publicar',   web_status: 'inactive' },
  { value: 'active',      label: 'Publicada',             web_status: 'active'   },
  { value: 'bajo_oferta', label: 'Bajo oferta',           web_status: 'inactive' },
  { value: 'sold',        label: 'Vendida / Alquilada',   web_status: 'sold'     },
  { value: 'archived',    label: 'Archivada',             web_status: 'inactive' },
]
const CURRENCIES = [{ value: 'USD', label: 'USD $' }, { value: 'CRC', label: 'CRC ₡' }]
const AMENITIES_LIST = [
  'Piscina', 'Jacuzzi', 'Sauna',
  'Gimnasio', 'Cancha deportiva', 'Área de juegos',
  'Seguridad 24h', 'Portón eléctrico', 'Cámaras de seguridad',
  'BBQ / Rancho', 'Jardín', 'Terraza', 'Balcón',
  'Cuarto de servicio', 'Bodega', 'Elevador',
  'Generador', 'Placas solares', 'Cisterna',
  'Vista al mar', 'Vista al volcán', 'Vista al valle',
  'Aire acondicionado', 'Calefacción',
  'Área gourmet', 'Salón de eventos', 'Parqueo visitas',
]
// El orden refleja el flujo de captación, pero los tabs no se bloquean:
// en la práctica los datos llegan desordenados (las fotos antes que el
// contrato). El punto de progreso muestra lo que falta sin frustrar.
const TABS = [
  { id: 1, label: 'Captación',                  icon: '📋' },
  { id: 2, label: 'Características', icon: '📐' },
  { id: 3, label: 'Estudios',                   icon: '🔎' },
  { id: 4, label: 'Contratos',                  icon: '📄' },
  { id: 5, label: 'Descripción',                icon: '📝' },
  { id: 6, label: 'Media',                      icon: '📸' },
  { id: 8, label: 'Archivos',                   icon: '🗂️' },
  { id: 9, label: 'Notas',                      icon: '🗒️' },
  { id: 7, label: 'Portales',                   icon: '🌐' },
]

/* ── Types ───────────────────────────────────────────────────── */
interface PropertyFull {
  id: string; tenant_id: string; type: string; transaction: string
  crm_status: string; status: string; mandate_type: string | null; agent_id: string | null
  provincia: string | null; canton: string | null; distrito: string | null
  address: string | null; lat: number | null; lng: number | null
  finca_number: string | null; plano_number: string | null
  bedrooms: number | null; bathrooms: number | null
  area_m2: number | null; lot_m2: number | null
  parking: number | null; floors: number | null; year_built: number | null
  amenities: string[] | null; price: number; currency: string
  video_url: string | null; video_urls: string[] | null; tour_url: string | null; images: string[]
  title: string; description_es: string | null; description_en: string | null
  features: Record<string, string> | null
  doc_urls: { name: string; url: string }[] | null
}
interface PropertyType { id: string; label: string; value: string; icon: string | null }
interface Agent        { id: string; name: string }
interface LinkedContact { id: string; name: string; last_name: string | null; cedula: string | null; photo_url: string | null }
interface OwnerResult  {
  type: 'contact' | 'company'
  id: string; name: string; subtitle: string
  linkedContacts?: LinkedContact[]
}

/* ── Avatar helpers (same palette as ClientesClient) ─────────────── */
const AVATAR_PALETTE = [
  '#5B7FFF', '#E85D75', '#F59E0B', '#10B981',
  '#8B5CF6', '#EF4444', '#06B6D4', '#F97316',
  '#84CC16', '#EC4899', '#14B8A6', '#6366F1',
]
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}
function ownerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return fullName.slice(0, 2).toUpperCase()
}
function coInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/* ── Shared style ─────────────────────────────────────────────── */
const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}

/* ── Component ───────────────────────────────────────────────── */
export default function PropiedadPage() {
  const { id }       = useParams<{ id: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [prop,      setProp]      = useState<PropertyFull | null>(null)
  const [propTypes, setPropTypes] = useState<PropertyType[]>([])
  const [statuses,  setStatuses]  = useState<CrmStatus[]>(CRM_STATUSES_FALLBACK)
  const [amenities, setAmenities] = useState<string[]>(AMENITIES_LIST)
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [agentId,   setAgentId]   = useState('')
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState(Number(searchParams.get('tab') ?? '1'))
  const [estudiosCount,  setEstudiosCount]  = useState(0)
  const [contratosCount, setContratosCount] = useState(0)
  const [notasCount,     setNotasCount]     = useState(0)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [myUserId,  setMyUserId]  = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    getMembership().then(async m => {
      if (!m) return
      const adminRec = { tenant_id: m.tenantId }
      setIsAdmin(m.isAdmin)
      const { data: { user } } = await sb.auth.getUser()
      const [{ data: p }, { data: types }, { data: sts }, { data: ams }, { data: agentList }, { data: est }, { data: con }, { data: nts }, { data: me }] = await Promise.all([
        sb.from('properties').select('*').eq('id', id).eq('tenant_id', adminRec.tenant_id).single(),
        sb.from('property_types').select('id,label,value,icon').eq('tenant_id', adminRec.tenant_id).order('sort_order'),
        sb.from('property_statuses').select('value,label,web_status').eq('tenant_id', adminRec.tenant_id).order('position'),
        sb.from('property_amenities').select('name').eq('tenant_id', adminRec.tenant_id).order('position'),
        sb.from('users').select('id,name').eq('tenant_id', adminRec.tenant_id).order('name'),
        // Solo para el punto de progreso de esos tabs
        sb.from('crm_estudios').select('id').eq('property_id', id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any).from('contracts').select('id').eq('property_id', id).eq('active', true),
        sb.from('property_notes').select('id').eq('property_id', id),
        user
          ? sb.from('users').select('id').eq('auth_id', user.id).eq('tenant_id', adminRec.tenant_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      setMyUserId((me as { id: string } | null)?.id ?? null)
      if (p) { setProp(p as PropertyFull); setAgentId((p as PropertyFull).agent_id ?? '') }
      setEstudiosCount((est ?? []).length)
      setContratosCount((con ?? []).length)
      setNotasCount((nts ?? []).length)
      setPropTypes((types ?? []) as PropertyType[])
      if (sts && sts.length) setStatuses(sts as CrmStatus[])
      if (ams && ams.length) setAmenities((ams as { name: string }[]).map(a => a.name))
      setAgents((agentList ?? []) as Agent[])
      setLoading(false)
    })
  }, [id])

  const webStatusFor = (v: string) => statuses.find(s => s.value === v)?.web_status ?? 'inactive'

  async function saveStatus(newStatus: string) {
    if (!prop) return
    const { data } = await createClient().from('properties')
      .update({ crm_status: newStatus, status: webStatusFor(newStatus) })
      .eq('id', prop.id).select('*').single()
    if (data) setProp(data as PropertyFull)
  }

  async function saveAgent(newId: string) {
    if (!prop) return
    setAgentId(newId)
    // Al asignar agente, borrador → en captación. Solo avanza: nunca pisa un
    // estado posterior, ni vuelve atrás al desasignar.
    const patch: Record<string, string | null> = { agent_id: newId || null }
    if (newId && prop.crm_status === 'draft') {
      patch.crm_status = 'captacion'
      patch.status     = webStatusFor('captacion')
    }
    const { data } = await createClient().from('properties')
      .update(patch).eq('id', prop.id).select('*').single()
    if (data) setProp(data as PropertyFull)
  }

  async function saveTitle(newTitle: string) {
    if (!prop) return
    const { data } = await createClient().from('properties')
      .update({ title: newTitle }).eq('id', prop.id).select('*').single()
    if (data) setProp(data as PropertyFull)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>
  if (!prop)   return <div style={{ padding: 40, color: '#e53e3e', fontSize: 14 }}>Propiedad no encontrada.</div>

  // El agente edita solo las suyas; el admin todas. La RLS lo fuerza en la
  // base; acá se refleja en la UI para no mostrar formularios que fallarían.
  const canEdit = isAdmin || (!!myUserId && prop.agent_id === myUserId)

  // Qué etapa ya tiene datos. No bloquea nada: solo pinta el punto del tab.
  const progress: Record<number, boolean> = {
    1: Boolean(prop.type && prop.provincia),
    2: Boolean((prop.area_m2 || prop.bedrooms) && prop.price > 0),
    3: estudiosCount > 0,
    4: contratosCount > 0,
    5: Boolean(prop.description_es),
    6: (prop.images?.length ?? 0) > 0 || (prop.video_urls?.length ?? 0) > 0 || Boolean(prop.tour_url),
    7: false,
    8: (prop.doc_urls?.length ?? 0) > 0 || Boolean(prop.features?.informe_registral_url) || Boolean(prop.features?.plano_catastrado_url),
    9: notasCount > 0,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/propiedades')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0, fontFamily: 'inherit', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Inventario
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ borderLeft: '3px solid #111', paddingLeft: 14 }}>
            {canEdit
              ? <EditableTitle value={prop.title} onSave={saveTitle} />
              : <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{prop.title || <span style={{ color: '#bbb', fontWeight: 400 }}>Sin título</span>}</h1>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {prop.provincia && <span style={{ fontSize: 13, color: '#888' }}>📍 {[prop.canton, prop.provincia].filter(Boolean).join(', ')}</span>}
              {canEdit
                ? <StatusSelect value={prop.crm_status} statuses={statuses} onChange={saveStatus} />
                : (() => { const c = statusColor(prop.crm_status); return <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color }}>{statuses.find(s => s.value === prop.crm_status)?.label ?? prop.crm_status}</span> })()}
            </div>
          </div>
          {/* Agente: el admin reasigna; los demás lo ven de solo lectura */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Agente</span>
            {isAdmin && agents.length > 0 ? (
              <select value={agentId} onChange={e => saveAgent(e.target.value)}
                style={{ height: 34, padding: '0 10px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', maxWidth: 200 }}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: 13, color: '#5a6070', height: 34, display: 'flex', alignItems: 'center' }}>
                {agents.find(a => a.id === prop.agent_id)?.name ?? 'Sin asignar'}
              </span>
            )}
          </div>
        </div>
        {!canEdit && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, color: '#92610A' }}>
            <Icon name="lightbulb" size={15} />
            Solo lectura — no sos el agente asignado a esta propiedad. Un administrador o el agente asignado puede editarla.
          </div>
        )}
      </div>

      {/* Tab bar — estilo pestañas de navegador: esquinas superiores
          redondeadas y la activa "pegada" al contenido. El punto verde marca
          la etapa que ya tiene datos. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, borderBottom: '1px solid #dcdfe4', marginBottom: 24, flexWrap: 'wrap', paddingLeft: 2 }}>
        {TABS.map(t => {
          const on = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
              marginBottom: -1, flexShrink: 0,
              background: on ? '#fff' : '#f1f2f4',
              border: '1px solid #dcdfe4',
              // El borde inferior blanco de la activa tapa la línea del
              // contenedor: eso la "conecta" con el contenido de abajo.
              borderBottom: on ? '1px solid #fff' : '1px solid #dcdfe4',
              borderRadius: '9px 9px 0 0',
              color: on ? '#111' : '#6b7280',
              fontWeight: on ? 600 : 400,
              fontSize: 13, fontFamily: 'inherit', transition: 'background .15s, color .15s',
              position: 'relative', zIndex: on ? 1 : 0,
            }}>
              {t.label}
              <span title={progress[t.id] ? 'Con datos' : 'Pendiente'} style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: progress[t.id] ? '#10B981' : '#d5d9e0',
              }} />
            </button>
          )
        })}
      </div>

      {/* Tab content — fieldset disabled desactiva todos los controles de
          formulario de una si el usuario no puede editar. La regla oculta,
          además, el botón Guardar (submit) en solo-lectura: no sirve de nada
          mostrarlo si la RLS igual rechazaría el update. */}
      {!canEdit && <style>{'fieldset[disabled] button[type="submit"]{display:none}'}</style>}
      <fieldset disabled={!canEdit} style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}>
        {activeTab === 1 && <Tab1Captacion prop={prop} propTypes={propTypes} onSaved={setProp} />}
        {activeTab === 2 && <Tab2CaracteristicasAmenidades prop={prop} amenities={amenities} isAdmin={isAdmin} onSaved={setProp} />}
        {activeTab === 3 && <Tab7Estudios  prop={prop} />}
        {activeTab === 4 && <TabContrato   prop={prop} onSaved={setProp} />}
        {activeTab === 5 && <Tab5Descripcion prop={prop} onSaved={setProp} />}
        {activeTab === 6 && <Tab6Media     prop={prop} onSaved={setProp} />}
        {activeTab === 8 && <TabArchivos   prop={prop} onSaved={setProp} />}
        {activeTab === 9 && <TabNotas      prop={prop} onCount={setNotasCount} />}
        {activeTab === 7 && <TabPortales />}
      </fieldset>
    </div>
  )
}

/* ── Título editable inline (click para editar, como el nombre del agente) ── */
function EditableTitle({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  function commit() {
    setEditing(false)
    const v = draft.trim()
    if (v !== (value ?? '')) onSave(v)
  }

  if (editing) return (
    <input ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
      placeholder="Título de la propiedad"
      style={{ fontSize: 26, fontWeight: 700, color: '#111', lineHeight: 1.2, margin: '0 0 6px', border: 'none', borderBottom: '2px solid #111', outline: 'none', padding: 0, fontFamily: 'inherit', width: '100%', minWidth: 320, background: 'transparent' }} />
  )
  return (
    <h1 onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      title="Click para editar"
      style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: '0 0 6px', lineHeight: 1.2, cursor: 'text' }}>
      {value || <span style={{ color: '#bbb', fontWeight: 400 }}>Sin título</span>}
    </h1>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 1 — Captación
══════════════════════════════════════════════════════════════ */
function Tab1Captacion({ prop, propTypes, onSaved }: {
  prop: PropertyFull; propTypes: PropertyType[]
  onSaved: (p: PropertyFull) => void
}) {
  const [propType,    setPropType]    = useState(prop.type ?? '')
  const [transaction, setTransaction] = useState(prop.transaction ?? 'sale')
  const [provincia,   setProvincia]   = useState(prop.provincia ?? '')
  const [canton,      setCanton]      = useState(prop.canton ?? '')
  const [distrito,    setDistrito]    = useState(prop.distrito ?? '')
  const [address,     setAddress]     = useState(prop.address ?? '')
  const [finca,       setFinca]       = useState(prop.finca_number ?? '')
  const [plano,       setPlano]       = useState(prop.plano_number ?? '')
  const [mapLat,      setMapLat]      = useState<number | null>(prop.lat)
  const [mapLng,      setMapLng]      = useState<number | null>(prop.lng)
  const [gmapsLink,   setGmapsLink]   = useState(prop.features?.gmaps_link ?? '')
  const [gmapsError,  setGmapsError]  = useState('')
  const [geocoding,   setGeocoding]   = useState(false)
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)

  const mapContainerRef   = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<mapboxgl.Map | null>(null)
  const markerRef         = useRef<mapboxgl.Marker | null>(null)

  const cantons   = provincia ? getCantons(provincia) : []
  const districts = (provincia && canton) ? getDistricts(provincia, canton) : []

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return
    if (mapRef.current) return
    let map: mapboxgl.Map
    import('mapbox-gl').then(({ default: mb }) => {
      if (!mapContainerRef.current) return
      mb.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
      const center: [number, number] = (mapLng && mapLat) ? [mapLng, mapLat] : [-84.0, 9.93]
      map = new mb.Map({ container: mapContainerRef.current!, style: 'mapbox://styles/mapbox/streets-v12', center, zoom: mapLng ? 15 : 10 })
      map.addControl(new mb.NavigationControl(), 'top-right')
      if (mapLng && mapLat) {
        markerRef.current = new mb.Marker({ color: '#6b2fa0', draggable: true }).setLngLat([mapLng, mapLat]).addTo(map)
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLngLat()
          setMapLng(Math.round(p.lng * 1e6) / 1e6); setMapLat(Math.round(p.lat * 1e6) / 1e6)
        })
      }
      map.on('click', e => {
        const { lng, lat } = e.lngLat
        const rLng = Math.round(lng * 1e6) / 1e6; const rLat = Math.round(lat * 1e6) / 1e6
        if (markerRef.current) { markerRef.current.setLngLat([lng, lat]) }
        else {
          markerRef.current = new mb.Marker({ color: '#6b2fa0', draggable: true }).setLngLat([lng, lat]).addTo(map)
          markerRef.current.on('dragend', () => {
            const p = markerRef.current!.getLngLat()
            setMapLng(Math.round(p.lng * 1e6) / 1e6); setMapLat(Math.round(p.lat * 1e6) / 1e6)
            reverseGeocode(Math.round(p.lng * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6)
          })
        }
        setMapLng(rLng); setMapLat(rLat); reverseGeocode(rLng, rLat)
      })
      mapRef.current = map
    })
    return () => { if (map) map.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flyToLocation = useCallback((lng: number, lat: number) => {
    if (!mapRef.current) return
    import('mapbox-gl').then(({ default: mb }) => {
      mapRef.current!.flyTo({ center: [lng, lat], zoom: 16, duration: 1200 })
      if (markerRef.current) { markerRef.current.setLngLat([lng, lat]) }
      else {
        markerRef.current = new mb.Marker({ color: '#6b2fa0', draggable: true }).setLngLat([lng, lat]).addTo(mapRef.current!)
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLngLat()
          setMapLng(Math.round(p.lng * 1e6) / 1e6); setMapLat(Math.round(p.lat * 1e6) / 1e6)
        })
      }
      setMapLng(Math.round(lng * 1e6) / 1e6); setMapLat(Math.round(lat * 1e6) / 1e6)
    })
  }, [])

  async function reverseGeocode(lng: number, lat: number) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN; if (!token) return
    setGeocoding(true)
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&country=cr&language=es&types=region,district,place,locality`)
      const json = await res.json()
      const features = json.features ?? []
      let foundProv = '', foundCanton = ''
      for (const feat of features) {
        const pt = feat.place_type?.[0]; const name: string = feat.text ?? ''
        const ctx: { id: string; text: string }[] = feat.context ?? []
        if (pt === 'region') foundProv = name
        if (pt === 'district' || pt === 'place') foundCanton = name
        for (const c of ctx) {
          if (c.id?.startsWith('region')) foundProv = c.text
          if (c.id?.startsWith('district') || c.id?.startsWith('place')) foundCanton = c.text
        }
      }
      const matchedProv = PROVINCIAS.find(p => p.toLowerCase() === foundProv.toLowerCase() || foundProv.toLowerCase().includes(p.toLowerCase()))
      if (matchedProv) {
        setProvincia(matchedProv)
        const cl = getCantons(matchedProv)
        const mc = cl.find(c => c.name.toLowerCase() === foundCanton.toLowerCase() || foundCanton.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(foundCanton.toLowerCase()))
        if (mc) { setCanton(mc.name); setDistrito('') } else { setCanton(''); setDistrito('') }
      }
    } catch { /* silent */ }
    setGeocoding(false)
  }

  function parseGmapsLink(url: string): { lat: number; lng: number } | 'short' | null {
    // Detect short/redirect URLs — coordinates can't be extracted client-side
    if (/goo\.gl|maps\.app\.goo\.gl/i.test(url)) return 'short'

    // Decode URL-encoded characters
    const decoded = url.replace(/%2C/gi, ',').replace(/%40/gi, '@').replace(/%3F/gi, '?').replace(/%3D/gi, '=')

    const patterns: Array<[RegExp, boolean]> = [
      // @lat,lng (standard desktop/mobile link) — most common
      [/@(-?\d+\.\d+),(-?\d+\.\d+)/, false],
      // !3d{lat}!4d{lng} (embed URLs, data= parameter)
      [/!3d(-?\d+\.\d+)[^!]*!4d(-?\d+\.\d+)/, false],
      // ?q=lat,lng or &q=lat,lng
      [/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, false],
      // ?ll=lat,lng
      [/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, false],
      // center=lat,lng
      [/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/, false],
      // cbll=lat,lng (Street View)
      [/[?&]cbll=(-?\d+\.\d+),(-?\d+\.\d+)/, false],
    ]

    for (const [re, swap] of patterns) {
      const m = decoded.match(re)
      if (m) {
        let lat = parseFloat(m[1])
        let lng = parseFloat(m[2])
        if (swap) [lat, lng] = [lng, lat]
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          return { lat, lng }
        }
      }
    }
    return null
  }

  async function handleGmapsLink(url: string) {
    setGmapsLink(url); setGmapsError('')
    if (!url.trim()) return
    const result = parseGmapsLink(url)
    if (result === 'short') {
      setGmapsError('Link corto detectado — abrí Google Maps en el navegador, clic en Compartir → Copiar enlace, y pegá ese link aquí.')
      return
    }
    if (!result) {
      setGmapsError('No se encontraron coordenadas. Pegá el link completo de Google Maps (debe contener el símbolo @).')
      return
    }
    flyToLocation(result.lng, result.lat)
    await reverseGeocode(result.lng, result.lat)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => { flyToLocation(pos.coords.longitude, pos.coords.latitude); setGeoLoading(false) },
      () => setGeoLoading(false),
      { timeout: 8000 }
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    const sb = createClient()
    // El informe registral y el plano catastrado se subieron y se mudaron al
    // tab Archivos; acá quedan solo los datos registrales y la ubicación.
    const newFeatures = {
      ...(prop.features ?? {}),
      ...(gmapsLink ? { gmaps_link: gmapsLink } : {}),
    }
    // crm_status/status no se tocan acá: los maneja el selector del header.
    const { data, error } = await sb.from('properties').update({
      type:       propType,
      transaction: transaction,
      provincia: provincia   || null,
      canton:    canton      || null,
      distrito:  distrito    || null,
      address:   address     || null,
      lat: mapLat, lng: mapLng,
      finca_number: finca  || null,
      plano_number: plano  || null,
      features: newFeatures,
    }).eq('id', prop.id).select('*').single()
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    onSaved(data as PropertyFull); setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* El Estado CRM vive en el header (visible en todos los tabs). */}

      {/* Dueños primero: es lo que abre la captación. */}
      <OwnerSection prop={prop} />

      {/* ── Datos básicos ──────────────────────────────── */}
      <FormSection title="Datos básicos">
        <FieldLabel>Tipo de transacción</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {TRANSACTIONS.map(t => (
            <PillBtn key={t.value} active={transaction === t.value} onClick={() => setTransaction(t.value)}>
              {t.label}
            </PillBtn>
          ))}
        </div>

        <FieldLabel>Tipo de propiedad</FieldLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {propTypes.map(t => (
            <button key={t.value} type="button" onClick={() => setPropType(t.value)}
              style={{ padding: '8px 16px', borderRadius: 100, border: '2px solid', borderColor: propType === t.value ? '#111' : '#e0e0e0', background: propType === t.value ? '#111' : '#fff', color: propType === t.value ? '#fff' : '#555', fontSize: 13, fontWeight: propType === t.value ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </FormSection>

      {/* ── 3. Datos registrales y ubicación ─────────────── */}
      <FormSection title="Datos registrales y ubicación">
        {/* Finca + Plano */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div><FieldLabel>Número de finca</FieldLabel><input value={finca} onChange={e => setFinca(e.target.value)} placeholder="Ej: 1-12345-000" style={inputSt} /></div>
          <div><FieldLabel>Número de plano catastrado</FieldLabel><input value={plano} onChange={e => setPlano(e.target.value)} placeholder="Ej: SJ-1234567-2010" style={inputSt} /></div>
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>
          El informe registral y el plano catastrado se adjuntan en el tab <strong>Archivos</strong>.
        </p>

        {/* Google Maps link */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Link de Google Maps</FieldLabel>
          <input value={gmapsLink} onChange={e => handleGmapsLink(e.target.value)} placeholder="Pegá el link completo de Google Maps aquí…" style={inputSt} />
          {gmapsError && <p style={{ fontSize: 12, color: '#e53e3e', margin: '6px 0 0' }}>{gmapsError}</p>}
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Compartí el link desde el navegador (no el link corto goo.gl).</p>
        </div>

        {/* Map */}
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #e0e0e0', marginBottom: 8 }}>
          <div ref={mapContainerRef} style={{ height: 340, width: '100%' }} />
          <button type="button" onClick={useMyLocation} disabled={geoLoading}
            style={{ position: 'absolute', top: 12, left: 12, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 500, cursor: geoLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontFamily: 'inherit' }}>
            {geoLoading ? 'Localizando…' : 'Mi ubicación'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {mapLat !== null && <p style={{ fontSize: 11, color: '#6b2fa0', margin: 0, fontWeight: 500 }}>✓ {mapLat}, {mapLng}</p>}
          {geocoding && <p style={{ fontSize: 11, color: '#888', margin: 0 }}>Detectando ubicación…</p>}
        </div>

        {/* Provincia / Cantón / Distrito */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
          <div>
            <FieldLabel>Provincia</FieldLabel>
            <select value={provincia} onChange={e => { setProvincia(e.target.value); setCanton(''); setDistrito('') }} style={inputSt}>
              <option value="">Seleccionar…</option>
              {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Cantón</FieldLabel>
            <select value={canton} onChange={e => { setCanton(e.target.value); setDistrito('') }} disabled={!provincia} style={{ ...inputSt, opacity: !provincia ? 0.5 : 1 }}>
              <option value="">Seleccionar…</option>
              {cantons.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Distrito</FieldLabel>
            <select value={distrito} onChange={e => setDistrito(e.target.value)} disabled={!canton} style={{ ...inputSt, opacity: !canton ? 0.5 : 1 }}>
              <option value="">Seleccionar…</option>
              {getDistricts(provincia, canton).map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>Dirección / señas exactas</FieldLabel>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: 200m norte del parque, casa esquinera" style={inputSt} />
        </div>
      </FormSection>

      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 2 — Características
══════════════════════════════════════════════════════════════ */
// Medidas + amenidades + precio en un solo tab y un solo guardado.
// El precio vive acá (y no en Contrato) porque es insumo del contrato:
// se define antes de firmarlo.
function Tab2CaracteristicasAmenidades({ prop, amenities, isAdmin, onSaved }: {
  prop: PropertyFull; amenities: string[]; isAdmin: boolean; onSaved: (p: PropertyFull) => void
}) {
  const [bedrooms,   setBedrooms]   = useState(prop.bedrooms   ?? '')
  const [bathrooms,  setBathrooms]  = useState(prop.bathrooms  ?? '')
  const [areaM2,     setAreaM2]     = useState(prop.area_m2    ?? '')
  const [lotM2,      setLotM2]      = useState(prop.lot_m2     ?? '')
  const [parking,    setParking]    = useState(prop.parking    ?? '')
  const [floors,     setFloors]     = useState(prop.floors     ?? '')
  const [yearBuilt,  setYearBuilt]  = useState(prop.year_built ?? '')
  const [halfBaths,  setHalfBaths]  = useState(prop.features?.half_baths ?? '')
  const [maintFee,   setMaintFee]   = useState(prop.features?.maintenance_fee ?? '')
  const [maintCurr,  setMaintCurr]  = useState(prop.features?.maintenance_currency ?? 'USD')
  const [selected,   setSelected]   = useState<string[]>(prop.amenities ?? [])
  const [custom,     setCustom]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  function toggle(a: string) {
    setSelected(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }
  function addCustom() {
    const v = custom.trim()
    if (!v || selected.includes(v)) return
    setSelected(prev => [...prev, v]); setCustom('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    // Medios baños y la cuota de mantenimiento no tienen columna propia: viven
    // en features. El precio sí es del contrato (base de la comisión).
    const newFeatures = {
      ...(prop.features ?? {}),
      half_baths: halfBaths !== '' ? Number(halfBaths) : null,
      ...(maintFee ? { maintenance_fee: maintFee, maintenance_currency: maintCurr } : { maintenance_fee: '', maintenance_currency: '' }),
    }
    const { data, error } = await createClient().from('properties').update({
      bedrooms:   bedrooms   !== '' ? Number(bedrooms)  : null,
      bathrooms:  bathrooms  !== '' ? Number(bathrooms) : null,
      area_m2:    areaM2     !== '' ? Number(areaM2)    : null,
      lot_m2:     lotM2      !== '' ? Number(lotM2)     : null,
      parking:    parking    !== '' ? Number(parking)   : null,
      floors:     floors     !== '' ? Number(floors)    : null,
      year_built: yearBuilt  !== '' ? Number(yearBuilt) : null,
      amenities:  selected,
      features:   newFeatures,
    }).eq('id', prop.id).select('*').single()
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    onSaved(data as PropertyFull); setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title="Medidas y espacios">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          <NumberField label="Área construida (m²)"  value={areaM2}    onChange={setAreaM2}    placeholder="Ej: 120" />
          <NumberField label="Área del terreno (m²)" value={lotM2}     onChange={setLotM2}     placeholder="Ej: 300" />
          <NumberField label="Año de construcción"   value={yearBuilt} onChange={setYearBuilt} placeholder="Ej: 2018" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <NumberField label="Habitaciones"    value={bedrooms}  onChange={setBedrooms}  placeholder="Ej: 3" />
          <NumberField label="Baños"           value={bathrooms} onChange={setBathrooms} placeholder="Ej: 2" />
          <NumberField label="Medios baños"    value={halfBaths} onChange={setHalfBaths} placeholder="Ej: 1" />
          <NumberField label="Parqueos"        value={parking}   onChange={setParking}   placeholder="Ej: 1" />
          <NumberField label="Plantas / Pisos" value={floors}    onChange={setFloors}    placeholder="Ej: 2" />
        </div>
      </FormSection>

      <FormSection title="Cuota de mantenimiento (opcional)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14 }}>
          <input type="text" inputMode="numeric" value={maintFee} onChange={e => setMaintFee(e.target.value)}
            placeholder="Ej: 80000" style={inputSt} />
          <select value={maintCurr} onChange={e => setMaintCurr(e.target.value)} style={inputSt}>
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </FormSection>

      <FormSection title={`Amenidades seleccionadas (${selected.length})`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {amenities.map(a => {
            const on = selected.includes(a)
            return (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `2px solid ${on ? '#111' : '#e0e0e0'}`, background: on ? '#111' : '#fff', cursor: 'pointer', transition: 'all .12s', userSelect: 'none' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(a)} style={{ display: 'none' }} />
                <span style={{ fontSize: 14 }}>{on ? '✓' : '○'}</span>
                <span style={{ fontSize: 13, color: on ? '#fff' : '#444', fontWeight: on ? 600 : 400 }}>{a}</span>
              </label>
            )
          })}
        </div>
        {/* Solo el admin agrega amenidades nuevas al catálogo. El agente elige
            entre las existentes pero no inventa nuevas. */}
        {isAdmin && (
          <div>
            <FieldLabel>Agregar amenidad personalizada</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={custom} onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                placeholder="Escribí y presioná Enter o Agregar…"
                style={{ ...inputSt, flex: 1 }} />
              <button type="button" onClick={addCustom}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                + Agregar
              </button>
            </div>
          </div>
        )}
        {selected.filter(a => !amenities.includes(a)).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {selected.filter(a => !amenities.includes(a)).map(a => (
              <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary, #111)', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500 }}>
                {a}
                <button type="button" onClick={() => setSelected(prev => prev.filter(x => x !== a))}
                  style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </FormSection>

      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 3 — Amenidades
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TAB 4 — Precio
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TAB 5 — Descripción
══════════════════════════════════════════════════════════════ */
function Tab5Descripcion({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [descEs,  setDescEs]  = useState(prop.description_es ?? '')
  const [descEn,  setDescEn]  = useState(prop.description_en ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    const { data, error } = await createClient().from('properties').update({
      description_es: descEs || null,
      description_en: descEn || null,
    }).eq('id', prop.id).select('*').single()
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    onSaved(data as PropertyFull); setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title="Descripción">
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Descripción en español</FieldLabel>
          <textarea value={descEs} onChange={e => setDescEs(e.target.value)} rows={8}
            placeholder="Descripción detallada de la propiedad en español…"
            style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Descripción en inglés (opcional)</FieldLabel>
          <textarea value={descEn} onChange={e => setDescEn(e.target.value)} rows={6}
            placeholder="Detailed property description in English…"
            style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
        </div>
      </FormSection>
      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 6 — Fotos
══════════════════════════════════════════════════════════════ */
// Media = fotos + videos + tour 360. Las fotos se auto-guardan al subir
// (siempre fue así); videos y 360 son texto, así que van con Guardar
// explícito para no pegarle a la base en cada tecla.
function Tab6Media({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [images,    setImages]    = useState<string[]>(prop.images ?? [])
  const [videos,    setVideos]    = useState<string[]>(prop.video_urls ?? [])
  const [newVideo,  setNewVideo]  = useState('')
  const [tourUrl,   setTourUrl]   = useState(prop.tour_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mediaSaving, setMediaSaving] = useState(false)
  const [mediaSaved,  setMediaSaved]  = useState(false)
  const [mediaError,  setMediaError]  = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addVideo() {
    const v = newVideo.trim()
    if (!v || videos.includes(v)) return
    setVideos(prev => [...prev, v]); setNewVideo('')
  }

  async function saveMedia(e: React.FormEvent) {
    e.preventDefault(); setMediaSaving(true); setMediaError(null); setMediaSaved(false)
    const { data, error } = await createClient().from('properties').update({
      video_urls: videos,
      tour_url:   tourUrl.trim() || null,
    }).eq('id', prop.id).select('*').single()
    if (error) { setMediaError(`Error: ${error.message}`); setMediaSaving(false); return }
    onSaved(data as PropertyFull); setMediaSaving(false); setMediaSaved(true)
    setTimeout(() => setMediaSaved(false), 2500)
  }

  async function handleFiles(files: FileList) {
    setUploading(true); setSaveError(null)
    const sb = createClient()
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${prop.tenant_id}/${prop.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await sb.storage.from('property-photos').upload(path, file, { upsert: false })
      if (error) { setSaveError(`Error subiendo ${file.name}: ${error.message}`); continue }
      newUrls.push(sb.storage.from('property-photos').getPublicUrl(path).data.publicUrl)
    }
    const updated = [...images, ...newUrls]
    setImages(updated)
    // Auto-save after upload
    const { data, error } = await sb.from('properties').update({ images: updated }).eq('id', prop.id).select('*').single()
    if (!error && data) onSaved(data as PropertyFull)
    setUploading(false)
  }

  async function removeImage(url: string) {
    const updated = images.filter(i => i !== url)
    setImages(updated)
    const { data, error } = await createClient().from('properties').update({ images: updated }).eq('id', prop.id).select('*').single()
    if (!error && data) onSaved(data as PropertyFull)
  }

  async function setCover(url: string) {
    const updated = [url, ...images.filter(i => i !== url)]
    setImages(updated)
    const { data, error } = await createClient().from('properties').update({ images: updated }).eq('id', prop.id).select('*').single()
    if (!error && data) { onSaved(data as PropertyFull); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title={`Fotos (${images.length})`}>
        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          {...dropProps(handleFiles)}
          style={{ border: '2px dashed #e0e0e0', borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, transition: 'border-color .15s', background: '#fafafa' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#6b2fa0'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0'}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#444', marginBottom: 4 }}>
            {uploading ? 'Subiendo…' : 'Clic para subir fotos'}
          </div>
          <div style={{ fontSize: 12, color: '#aaa' }}>O arrastrar y soltar — JPG, PNG, WebP</div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={e => { if (e.target.files?.length) handleFiles(e.target.files) }}
          style={{ display: 'none' }} />

        {/* Photo grid */}
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {images.map((url, i) => (
              <div key={url} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/10', background: '#f0f0f0', border: i === 0 ? '2px solid #111' : '2px solid transparent' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {i === 0 && (
                  <div style={{ position: 'absolute', top: 6, left: 6, background: 'var(--color-primary, #111)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>PORTADA</div>
                )}
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                  {i !== 0 && (
                    <button onClick={() => setCover(url)} title="Usar como portada"
                      style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,.55)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⭐</button>
                  )}
                  <button onClick={() => removeImage(url)} title="Eliminar"
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(220,38,38,.8)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {images.length === 0 && !uploading && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>Sin fotos aún</div>
        )}
        {saveError && <p style={{ fontSize: 12, color: '#e53e3e', margin: '12px 0 0' }}>{saveError}</p>}
        {saved && <p style={{ fontSize: 12, color: '#10B981', margin: '12px 0 0', fontWeight: 600 }}>✓ Portada actualizada</p>}
      </FormSection>

      <form onSubmit={saveMedia} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormSection title={`Videos (${videos.length})`}>
          <FieldLabel>Agregar video (YouTube / Vimeo)</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newVideo} onChange={e => setNewVideo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVideo() } }}
              placeholder="https://youtube.com/watch?v=…"
              style={{ ...inputSt, flex: 1 }} />
            <button type="button" onClick={addVideo}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              + Agregar
            </button>
          </div>
          {videos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {videos.map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>🎬</span>
                  <a href={v} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#1B6EF3', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</a>
                  <button type="button" onClick={() => setVideos(prev => prev.filter(x => x !== v))} title="Quitar"
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: 13 }}>Sin videos aún</div>
          )}
        </FormSection>

        <FormSection title="Tour 360">
          <FieldLabel>Link del tour (Matterport, Kuula, etc.)</FieldLabel>
          <input value={tourUrl} onChange={e => setTourUrl(e.target.value)}
            placeholder="https://my.matterport.com/show/?m=…"
            style={inputSt} />
          <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>
            Se guarda el link y lo embebemos; el hosting queda del lado del proveedor.
          </p>
          {tourUrl.trim() && (
            <a href={tourUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#1B6EF3', textDecoration: 'none' }}>
              Abrir tour ↗
            </a>
          )}
        </FormSection>

        <SaveBar saving={mediaSaving} saved={mediaSaved} error={mediaError} />
      </form>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 7 — Estudios (registral y mercado, generados por los agentes AIre)
══════════════════════════════════════════════════════════════ */
interface Comparable { descripcion?: string; precio?: number; m2?: number; link?: string }
interface EstudioDatos {
  propietario?: string; cedula?: string; naturaleza?: string
  provincia?: string; canton?: string; distrito?: string
  medida_m2?: number; valor_fiscal?: number; plano?: string
  gravamenes?: string; anotaciones?: string
  comparables?: Comparable[]; metodo?: string; fuentes?: string[]
}
interface Estudio {
  id: string
  tipo: 'registral' | 'mercado' | string
  resultado: 'limpio' | 'revisar' | 'problema' | null
  resumen: string | null
  pdf_path: string | null
  precio_min: number | null
  precio_max: number | null
  precio_sugerido: number | null
  datos: EstudioDatos | null
  created_at: string
}

const RESULTADO_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  limpio:   { bg: '#ECFDF5', fg: '#059669', label: '✓ Limpio' },
  revisar:  { bg: '#FFFBEB', fg: '#D97706', label: '⚠ Revisar' },
  problema: { bg: '#FEF2F2', fg: '#DC2626', label: '✕ Problema' },
}

function Tab7Estudios({ prop }: { prop: PropertyFull }) {
  const [estudios, setEstudios] = useState<Estudio[] | null>(null)

  useEffect(() => {
    createClient()
      .from('crm_estudios')
      .select('id,tipo,resultado,resumen,pdf_path,precio_min,precio_max,precio_sugerido,datos,created_at')
      .eq('property_id', prop.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEstudios((data as Estudio[]) ?? []))
  }, [prop.id])

  if (estudios === null) {
    return <p style={{ fontSize: 13, color: '#888', padding: '8px 2px' }}>Cargando estudios…</p>
  }
  if (estudios.length === 0) {
    return (
      <FormSection title="Estudios">
        <div style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
          <p style={{ fontSize: 13, margin: 0 }}>Aún no hay estudios para esta propiedad.</p>
          <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0' }}>
            Los agentes (Vera, Vega) los generan automáticamente cuando se registra la finca.
          </p>
        </div>
      </FormSection>
    )
  }

  const fmt = (n: number | null) => n == null ? '—' : `$${n.toLocaleString('en-US')}`
  const fecha = (s: string) => new Date(s).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {estudios.map(e => {
        const rs = e.resultado ? RESULTADO_STYLE[e.resultado] : null
        const esMercado = e.tipo === 'mercado'
        return (
          <div key={e.id} style={{ background: '#fff', borderRadius: 12, padding: '22px 26px', border: '1px solid #ebebeb' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{esMercado ? '📊' : '📋'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Estudio {esMercado ? 'de mercado' : 'registral'}
                </span>
                {rs && (
                  <span style={{ background: rs.bg, color: rs.fg, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                    {rs.label}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#aaa' }}>{fecha(e.created_at)}</span>
            </div>

            {/* Precio (solo mercado) */}
            {esMercado && (e.precio_sugerido != null || e.precio_min != null) && (
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Rango</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#444' }}>{fmt(e.precio_min)} – {fmt(e.precio_max)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Sugerido</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{fmt(e.precio_sugerido)}</div>
                </div>
              </div>
            )}

            {/* Ficha registral estructurada */}
            {!esMercado && e.datos && <RegistralDatos d={e.datos} />}

            {/* Comparables (mercado) */}
            {esMercado && e.datos?.comparables && e.datos.comparables.length > 0 && (
              <MercadoComparables comps={e.datos.comparables} metodo={e.datos.metodo} />
            )}

            {/* Resumen (titular / fallback) */}
            {e.resumen && (
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: '#777', margin: '14px 0 0', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{e.resumen}</p>
            )}

            {/* PDF */}
            {e.pdf_path && (
              <a href={e.pdf_path} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 13, color: '#2563EB', textDecoration: 'none', fontWeight: 500 }}>
                📎 Ver PDF del estudio
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* Ficha de datos de un estudio registral */
function RegistralDatos({ d }: { d: EstudioDatos }) {
  const ubic = [d.distrito, d.canton, d.provincia].filter(Boolean).join(', ')
  const rows: { label: string; value: string }[] = []
  if (d.propietario)        rows.push({ label: 'Propietario', value: d.propietario })
  if (d.cedula)             rows.push({ label: 'Cédula',      value: d.cedula })
  if (d.naturaleza)         rows.push({ label: 'Naturaleza',  value: d.naturaleza })
  if (ubic)                 rows.push({ label: 'Ubicación',   value: ubic })
  if (d.medida_m2 != null)  rows.push({ label: 'Medida',      value: `${d.medida_m2.toLocaleString('en-US')} m²` })
  if (d.valor_fiscal != null) rows.push({ label: 'Valor fiscal', value: `₡${d.valor_fiscal.toLocaleString('en-US')}` })
  if (d.plano)              rows.push({ label: 'Plano',       value: d.plano })

  const isClean = (v?: string) => !v || /^(no hay|ningun|sin )/i.test(v.trim())
  const flags: { label: string; value: string }[] = []
  if (d.gravamenes != null)  flags.push({ label: 'Gravámenes',  value: d.gravamenes })
  if (d.anotaciones != null) flags.push({ label: 'Anotaciones', value: d.anotaciones })

  if (!rows.length && !flags.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px' }}>
          {rows.map(r => (
            <div key={r.label}>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 13.5, color: '#222', fontWeight: 500 }}>{r.value}</div>
            </div>
          ))}
        </div>
      )}
      {flags.map(f => {
        const clean = isClean(f.value)
        return (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: clean ? '#F8FAF9' : '#FEF2F2', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ fontSize: 13 }}>{clean ? '✓' : '⚠'}</span>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.label}:</span>
            <span style={{ fontSize: 13, color: clean ? '#444' : '#DC2626', fontWeight: clean ? 400 : 600 }}>{f.value}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Tabla de comparables de un estudio de mercado */
function MercadoComparables({ comps, metodo }: { comps: Comparable[]; metodo?: string }) {
  const money = (n?: number) => n == null ? '—' : `$${n.toLocaleString('en-US')}`
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Comparables ({comps.length})
      </div>
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        {comps.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderTop: i ? '1px solid #f4f4f4' : 'none', fontSize: 13 }}>
            <span style={{ flex: 1, color: '#333' }}>
              {c.link
                ? <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'none' }}>{c.descripcion ?? 'Comparable'}</a>
                : (c.descripcion ?? 'Comparable')}
            </span>
            {c.m2 != null && <span style={{ color: '#999', minWidth: 60, textAlign: 'right' }}>{c.m2.toLocaleString('en-US')} m²</span>}
            <span style={{ color: '#111', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{money(c.precio)}</span>
          </div>
        ))}
      </div>
      {metodo && <p style={{ fontSize: 11.5, color: '#aaa', margin: '8px 0 0' }}>Método: {metodo}</p>}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   OWNER SECTION — Información del dueño
══════════════════════════════════════════════════════════════ */
function OwnerSection({ prop }: { prop: PropertyFull }) {
  const [country, setCountry] = useState('CR')
  useEffect(() => { getMembership().then(m => { if (m) setCountry(m.country) }) }, [])
  const [owners,       setOwners]       = useState<OwnerResult[]>([])
  const [inlineView,   setInlineView]   = useState<VCardViewType | null>(null)
  const [newOwnerType, setNewOwnerType] = useState<'contact' | 'company' | null>(null)
  const [lastQuery,    setLastQuery]    = useState('')
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<OwnerResult[]>([])
  const [searching,    setSearching]    = useState(false)
  const [dropOpen,     setDropOpen]     = useState(false)
  const [noResults,    setNoResults]    = useState(false)

  const wrapRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dueños desde property_owners (tabla real). El nombre/subtítulo se derivan
  // del contacto/empresa vinculado, así no quedan copias desactualizadas.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (createClient() as any).from('property_owners')
        .select('contact_id, company_id, crm_contacts(id,name,last_name,cedula,email), crm_companies(id,name,trade_name,cedula_juridica)')
        .eq('property_id', prop.id)
      if (cancelled) return
      const out: OwnerResult[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (data ?? []) as any[]) {
        if (r.crm_contacts) {
          const c = r.crm_contacts
          out.push({ type: 'contact', id: c.id, name: [c.name, c.last_name].filter(Boolean).join(' '), subtitle: c.email ?? c.cedula ?? 'Persona física' })
        } else if (r.crm_companies) {
          const co = r.crm_companies
          out.push({ type: 'company', id: co.id, name: co.trade_name || co.name, subtitle: co.trade_name ? co.name : (co.cedula_juridica ?? 'Empresa') })
        }
      }
      setOwners(out)
      // Traer los contactos vinculados de las empresas (foto fresca)
      const companyOwners = out.filter(o => o.type === 'company')
      if (!companyOwners.length) return
      const updates = await Promise.all(
        companyOwners.map(async o => ({ id: o.id, linkedContacts: await fetchLinkedContacts(o.id) }))
      )
      if (cancelled) return
      setOwners(prev => prev.map(o => {
        const u = updates.find(x => x.id === o.id)
        return u ? { ...o, linkedContacts: u.linkedContacts } : o
      }))
    })()
    return () => { cancelled = true }
  }, [prop.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function fetchLinkedContacts(companyId: string): Promise<LinkedContact[]> {
    const { data } = await createClient()
      .from('crm_contact_companies')
      .select('crm_contacts(id,name,last_name,cedula,photo_url)')
      .eq('company_id', companyId)
    if (!data) return []
    return (data as unknown as { crm_contacts: LinkedContact | null }[])
      .map(r => r.crm_contacts).filter(Boolean) as LinkedContact[]
  }

  async function addOwner(o: OwnerResult) {
    if (owners.some(x => x.id === o.id)) return
    // If company, fetch linked contacts automatically
    const enriched: OwnerResult = o.type === 'company'
      ? { ...o, linkedContacts: await fetchLinkedContacts(o.id) }
      : o
    setOwners(prev => [...prev, enriched])
    setDropOpen(false); setQuery(''); setResults([]); setNoResults(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any).from('property_owners').insert({
      tenant_id:   prop.tenant_id,
      property_id: prop.id,
      contact_id:  o.type === 'contact' ? o.id : null,
      company_id:  o.type === 'company' ? o.id : null,
    })
  }

  async function removeOwner(id: string) {
    const o = owners.find(x => x.id === id)
    setOwners(prev => prev.filter(x => x.id !== id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (createClient() as any).from('property_owners').delete().eq('property_id', prop.id)
    await (o?.type === 'company' ? q.eq('company_id', id) : q.eq('contact_id', id))
  }

  async function search(q: string) {
    if (q.trim().length < 2) { setResults([]); setNoResults(false); return }
    setSearching(true); setNoResults(false)
    const sb   = createClient()
    const term = `%${q.trim()}%`
    const tid  = prop.tenant_id
    const [{ data: contacts }, { data: companies }] = await Promise.all([
      sb.from('crm_contacts').select('id,name,last_name,cedula,email').eq('tenant_id', tid).eq('active', true)
        .or(`name.ilike.${term},last_name.ilike.${term},cedula.ilike.${term}`).limit(5),
      sb.from('crm_companies').select('id,name,trade_name,cedula_juridica').eq('tenant_id', tid).eq('active', true)
        .or(`name.ilike.${term},trade_name.ilike.${term},cedula_juridica.ilike.${term}`).limit(5),
    ])
    const out: OwnerResult[] = []
    for (const c of contacts  ?? []) out.push({ type: 'contact', id: c.id, name: [c.name, c.last_name].filter(Boolean).join(' '), subtitle: c.email ?? c.cedula ?? 'Persona física' })
    for (const co of companies ?? []) out.push({ type: 'company', id: co.id, name: co.trade_name || co.name, subtitle: co.trade_name ? co.name : (co.cedula_juridica ?? 'Empresa') })
    const filtered = out.filter(o => !owners.some(x => x.id === o.id))
    setResults(filtered); setNoResults(filtered.length === 0 && out.length === 0); setSearching(false)
  }

  function handleQueryChange(v: string) {
    setQuery(v); setLastQuery(v); setDropOpen(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 300)
  }

  async function handleNewOwnerCreated(result: NewOwnerResult) {
    setNewOwnerType(null)
    const enriched: OwnerResult = result.type === 'company'
      ? { ...result, linkedContacts: await fetchLinkedContacts(result.id) }
      : result
    await addOwner(enriched)
  }

  return (
    <>
    <FormSection title={`Dueños de la propiedad${owners.length > 0 ? ` (${owners.length})` : ''}`}>

      {/* ── Owners list ── */}
      {owners.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {owners.map(o => {
            const ac = nameToColor(o.name)
            return (
            <div key={o.id} style={{ borderRadius: 10, border: '1px solid #e2e5ea', overflow: 'hidden' }}>
              {/* Owner header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f9fafb' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: o.type === 'company' ? 8 : '50%', background: ac + '20', border: `2px solid ${ac}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: ac, flexShrink: 0, letterSpacing: '-0.5px' }}>
                  {o.type === 'company' ? coInitials(o.name) : ownerInitials(o.name)}
                </div>
                {/* Name — opens inline modal */}
                <div onClick={() => setInlineView({ type: o.type, id: o.id })} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{o.subtitle}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ac + '18', color: ac, flexShrink: 0 }}>
                  {o.type === 'contact' ? 'Físico' : 'Jurídico'}
                </span>
                <button type="button" onClick={() => removeOwner(o.id)}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '1px solid #e2e5ea', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#e53e3e', flexShrink: 0, fontFamily: 'inherit' }}>×</button>
              </div>

              {/* Linked contacts (jurídico only) */}
              {o.type === 'company' && (
                <div style={{ background: '#fff', borderTop: '1px solid #f0f0f0' }}>
                  {o.linkedContacts && o.linkedContacts.length > 0 ? (
                    o.linkedContacts.map((c, ci) => {
                      const cac  = nameToColor(c.name + (c.last_name ?? ''))
                      const init = ownerInitials([c.name, c.last_name].filter(Boolean).join(' '))
                      return (
                        <div key={c.id}
                          onClick={() => setInlineView({ type: 'contact', id: c.id })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px 9px 22px', borderTop: ci > 0 ? '1px solid #f9fafb' : 'none', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                        >
                          <span style={{ color: '#ddd', fontSize: 12, flexShrink: 0 }}>└</span>
                          {/* Avatar físico */}
                          <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: c.photo_url ? 'transparent' : cac + '22', border: `2px solid ${cac}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: cac, flexShrink: 0 }}>
                            {c.photo_url
                              ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : init}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                              {[c.name, c.last_name].filter(Boolean).join(' ')}
                            </span>
                            {c.cedula && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8, fontFamily: 'monospace' }}>{c.cedula}</span>}
                          </div>
                          <span style={{ fontSize: 11, color: '#c5cad3', flexShrink: 0 }}>→</span>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ padding: '9px 14px 9px 22px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#ddd', fontSize: 12 }}>└</span>
                      <span style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Sin personas físicas vinculadas a esta empresa</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* ── Search ── */}
      <div ref={wrapRef} style={{ position: 'relative', marginBottom: noResults ? 12 : 0 }}>
        <input value={query} onChange={e => handleQueryChange(e.target.value)}
          onFocus={() => query.length >= 2 && setDropOpen(true)}
          placeholder={owners.length > 0 ? 'Agregar otro dueño…' : 'Buscar por nombre, cédula o empresa…'}
          style={{ ...inputSt, paddingLeft: 36 }} />
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        {searching && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#aaa' }}>…</span>}
        {dropOpen && results.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden' }}>
            {results.map((r, i) => (
              <div key={r.id} onClick={() => addOwner(r)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f4f5f7' : 'none', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{r.type === 'contact' ? '👤' : '🏢'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.subtitle}</div>
                </div>
                <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>{r.type === 'contact' ? 'Físico' : 'Jurídico'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {noResults && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
          <p style={{ fontSize: 13, color: '#92400e', margin: '0 0 10px', fontWeight: 500 }}>
            No se encontró &ldquo;{query}&rdquo; en el CRM.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setNewOwnerType('contact')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              👤 Registrar como físico
            </button>
            <button type="button" onClick={() => setNewOwnerType('company')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              🏢 Registrar como jurídico
            </button>
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, color: '#aaa', margin: noResults ? '10px 0 0' : '8px 0 0' }}>
        {owners.length > 0 ? 'Podés agregar más dueños buscando abajo.' : 'Escribí 2 caracteres para buscar en contactos y empresas del CRM.'}
      </p>

    </FormSection>

    {inlineView && <ContactVCardModal view={inlineView} onClose={() => setInlineView(null)} />}
    {newOwnerType && (
      <NewOwnerModal
        type={newOwnerType}
        tenantId={prop.tenant_id}
        country={country}
        initial={lastQuery}
        onCreated={handleNewOwnerCreated}
        onClose={() => setNewOwnerType(null)}
      />
    )}
    </>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', border: '1px solid #ebebeb' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>{children}</div>
}
function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '8px 18px', borderRadius: 100, border: '2px solid', borderColor: active ? '#111' : '#e0e0e0', background: active ? '#111' : '#fff', color: active ? '#fff' : '#555', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
      {children}
    </button>
  )
}
function NumberField({ label, value, onChange, placeholder, icon }: { label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; icon?: string }) {
  return (
    <div>
      <FieldLabel>{icon ? `${icon} ${label}` : label}</FieldLabel>
      <input type="number" min={0} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputSt, textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '12px' }} />
    </div>
  )
}
// `property-docs` es privado, así que la URL guardada —que quedó con forma
// pública— ya no sirve para abrir nada. Se le saca la ruta y se firma al
// momento. Guardar la ruta en vez de la URL sería más limpio, pero obligaría a
// migrar lo ya guardado para ganar lo mismo.
async function abrirDocPrivado(url: string) {
  const marca = '/property-docs/'
  const i = url.indexOf(marca)
  if (i === -1) { window.open(url, '_blank'); return }
  const ruta = decodeURIComponent(url.slice(i + marca.length))
  const { data } = await createClient().storage.from('property-docs').createSignedUrl(ruta, 3600)
  window.open(data?.signedUrl ?? url, '_blank')
}

// Arrastrar y soltar sobre una zona: resalta el borde y entrega los archivos.
// Se usa en las fotos (Media) y en los adjuntos (Archivos).
//
// Un div con onDrop no es un control de formulario, así que el <fieldset
// disabled> de solo-lectura no lo desactiva solo: sin esto, quien no puede
// editar igual subiría el archivo al bucket (la RLS le impide adjuntarlo, pero
// el archivo queda). Se consulta el fieldset que ya envuelve los tabs en vez de
// pasar canEdit por props hasta acá.
function dropProps(onFiles: (f: FileList) => void) {
  const bloqueado = (e: React.DragEvent) =>
    Boolean((e.currentTarget as HTMLElement).closest('fieldset')?.disabled)
  const pintar = (e: React.DragEvent, color: string) => { (e.currentTarget as HTMLElement).style.borderColor = color }
  return {
    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); if (!bloqueado(e)) pintar(e, '#6b2fa0') },
    onDragLeave: (e: React.DragEvent) => pintar(e, '#e0e0e0'),
    onDrop:      (e: React.DragEvent) => {
      e.preventDefault(); pintar(e, '#e0e0e0')
      if (bloqueado(e)) return
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
    },
  }
}

function FileUploadField({ label, file, onSelect, onClear, inputRef, accept, existingUrl }: {
  label: string; file: File | null; onSelect: (f: File) => void; onClear: () => void
  inputRef: React.RefObject<HTMLInputElement | null>; accept: string; existingUrl?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div onClick={() => inputRef.current?.click()}
        {...dropProps(fs => { const f = fs[0]; if (f) onSelect(f) })}
        style={{ border: '2px dashed #e0e0e0', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', background: (file || existingUrl) ? 'rgba(107,47,160,.04)' : '#fff', transition: 'border-color .15s', display: 'flex', alignItems: 'center', gap: 10 }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#6b2fa0')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
      >
        <span style={{ fontSize: 20 }}>{file || existingUrl ? '📄' : '📎'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {file
            ? <div style={{ fontSize: 13, color: '#333', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
            : existingUrl
              ? <div style={{ fontSize: 13, color: '#6b2fa0', fontWeight: 500 }}>Archivo guardado — clic para reemplazar</div>
              : <div style={{ fontSize: 13, color: '#aaa' }}>Clic o arrastrá el archivo acá</div>
          }
        </div>
        {existingUrl && !file && <button type="button" onClick={e => { e.stopPropagation(); abrirDocPrivado(existingUrl) }}
          style={{ fontSize: 11, color: '#6b2fa0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, textDecoration: 'underline' }}>Abrir</button>}
        {(file || existingUrl) && <button type="button" onClick={e => { e.stopPropagation(); onClear() }}
          style={{ fontSize: 11, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Quitar</button>}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f) }} />
    </div>
  )
}
function SaveBar({ saving, saved, error }: { saving: boolean; saved: boolean; error: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 16 }}>
      <button type="submit" disabled={saving}
        style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit', transition: 'opacity .15s' }}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {saved  && <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>✓ Guardado</span>}
      {error  && <span style={{ fontSize: 13, color: '#e53e3e' }}>{error}</span>}
    </div>
  )
}
/* ── Tab Contrato ─────────────────────────────────────────────
   Un contrato vigente por propiedad (la tabla guarda el historial).
   Alimenta "Contratos por vencer" en Próximos eventos del dashboard.
─────────────────────────────────────────────────────────────── */
const CONTRACT_KINDS = [
  { value: 'exclusiva', label: 'Exclusiva' },
  { value: 'abierta',   label: 'Abierta' },
  { value: 'alquiler',  label: 'Alquiler' },
  { value: 'venta',     label: 'Venta' },
]
interface Contract {
  id: string; kind: string | null; start_date: string | null; end_date: string | null; duration_months: number | null
  price: number | null; currency: string | null; commission: number | null
  commission_type: string | null; commission_amount: number | null
  split_type: string | null; split_value: number | null
  // Set espejo para el alquiler (solo transaction = 'sale_rent').
  commission_rent: number | null; commission_rent_type: string | null; commission_rent_amount: number | null
  split_rent_type: string | null; split_rent_value: number | null
  status: string; notes: string | null
}

type Modo = 'pct' | 'amount'

// Suma meses a una fecha 'YYYY-MM-DD' y devuelve otra igual. Si el día no
// existe en el mes destino (31 de enero + 1 mes) se ajusta al último del mes,
// que es lo que uno espera de un plazo de contrato.
function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const base = new Date(y, m - 1 + meses, 1)
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const dia = Math.min(d, ultimoDia)
  const mm = String(base.getMonth() + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${base.getFullYear()}-${mm}-${dd}`
}

/* Cálculo de un negocio: comisión (% o monto) y división con el co-broker.
   Se usa en el render (DealRow) y al guardar. */
function computeDeal(price: string | number, commMode: Modo, commission: string | number, splitMode: Modo, splitValue: string | number) {
  const num = (v: string | number) => Number(String(v).replace(/,/g, '')) || 0
  const priceNum = num(price), commInput = num(commission)
  const commissionPct = commMode === 'pct' ? commInput : (priceNum > 0 ? commInput / priceNum * 100 : 0)
  const commissionAmt = commMode === 'amount' ? commInput : (priceNum > 0 ? priceNum * commInput / 100 : 0)
  const splitInput = num(splitValue)
  const splitAmt = splitMode === 'amount' ? splitInput : (commissionAmt > 0 ? commissionAmt * splitInput / 100 : 0)
  const splitPct = splitMode === 'pct' ? splitInput : (commissionAmt > 0 ? splitInput / commissionAmt * 100 : 0)
  return { priceNum, commissionPct, commissionAmt, splitInput, splitAmt, splitPct, netoAmt: commissionAmt - splitAmt }
}

/* Un negocio completo: precio + comisión + negocio externo, en 3 columnas.
   En "venta y alquiler" se muestran dos (uno por cada negocio). */
function DealRow(props: {
  priceLabel: string
  price: string | number; setPrice: (v: string) => void; currency: string; setCurrency: (v: string) => void
  commMode: Modo; setCommMode: (v: Modo) => void; commission: string | number; setCommission: (v: string) => void
  splitMode: Modo; setSplitMode: (v: Modo) => void; splitValue: string | number; setSplitValue: (v: string) => void
}) {
  const { priceLabel, price, setPrice, currency, setCurrency, commMode, setCommMode, commission, setCommission, splitMode, setSplitMode, splitValue, setSplitValue } = props
  const d = computeDeal(price, commMode, commission, splitMode, splitValue)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const money = (n: number) => `${currency === 'USD' ? '$' : '₡'}${Math.round(n).toLocaleString()}`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'start' }}>
      {/* Precio */}
      <div>
        <FieldLabel>{priceLabel}</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 8 }}>
          <input type="text" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="Ej: 150000" style={{ ...inputSt, fontWeight: 700 }} />
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputSt}>
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>Base de la comisión.</p>
      </div>
      {/* Comisión */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <FieldLabel>Comisión</FieldLabel><ModeToggle value={commMode} onChange={setCommMode} />
        </div>
        <input type="text" inputMode="decimal" value={commission} onChange={e => setCommission(e.target.value)}
          placeholder={commMode === 'pct' ? 'Ej: 5 (%)' : `Ej: 7500 (${currency})`} style={{ ...inputSt, fontWeight: 700 }} />
        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f7f6f9', border: '1px solid #ece9f2', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{commMode === 'pct' ? 'Comisión estimada' : 'Equivale a'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: d.commissionAmt > 0 ? '#111' : '#c5cad3' }}>
            {commMode === 'pct' ? (d.commissionAmt > 0 ? money(d.commissionAmt) : '—') : (d.commissionPct > 0 ? `${r2(d.commissionPct)}%` : '—')}
          </div>
          {d.commissionAmt > 0 && <div style={{ fontSize: 11, color: '#6b2fa0', marginTop: 4, fontWeight: 500 }}>{r2(d.commissionPct)}% de {money(d.priceNum)}</div>}
        </div>
      </div>
      {/* Negocio externo */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <FieldLabel>Negocio externo</FieldLabel><ModeToggle value={splitMode} onChange={setSplitMode} />
        </div>
        <input type="text" inputMode="decimal" value={splitValue} onChange={e => setSplitValue(e.target.value)}
          placeholder={splitMode === 'pct' ? 'Otra parte: 50 (%)' : `Otra parte: 3750 (${currency})`} style={inputSt} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <div style={{ padding: '8px 12px', background: '#f7f6f9', border: '1px solid #ece9f2', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Otra parte</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: d.splitAmt > 0 ? '#111' : '#c5cad3' }}>{d.splitAmt > 0 ? money(d.splitAmt) : '—'}</div>
            {d.splitAmt > 0 && <div style={{ fontSize: 10, color: '#9ca3af' }}>{r2(d.splitPct)}% de comisión</div>}
          </div>
          <div style={{ padding: '8px 12px', background: '#eef7f1', border: '1px solid #d6ecdf', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Nuestra parte</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: d.netoAmt > 0 ? '#0a7a3f' : '#c5cad3' }}>{d.commissionAmt > 0 ? money(d.netoAmt) : '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Toggle % / Monto — se usa en Comisión y en la división del negocio externo. */
function ModeToggle({ value, onChange }: { value: 'pct' | 'amount'; onChange: (v: 'pct' | 'amount') => void }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid #e2e5ea', borderRadius: 8, overflow: 'hidden' }}>
      {(['pct', 'amount'] as const).map(m => (
        <button key={m} type="button" onClick={() => onChange(m)} style={{
          padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          border: 'none', background: value === m ? '#111' : '#fff', color: value === m ? '#fff' : '#6b7280',
        }}>{m === 'pct' ? '%' : 'Monto'}</button>
      ))}
    </div>
  )
}

function TabContrato({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [row,        setRow]        = useState<Contract | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [kind,       setKind]       = useState('exclusiva')
  // El vencimiento sale de la fecha de firma + los meses de duración; no se
  // cargan a mano.
  const [firmaDate,  setFirmaDate]  = useState('')
  const [meses,      setMeses]      = useState(12)
  const [notes,      setNotes]      = useState('')
  // Comisión de venta (o del único negocio): % o monto (excluyentes).
  const [commMode,   setCommMode]   = useState<Modo>('pct')
  const [commission, setCommission] = useState<string | number>('')
  const [splitMode,  setSplitMode]  = useState<Modo>('pct')
  const [splitValue, setSplitValue] = useState<string | number>('')
  // Comisión de alquiler: negocio aparte, solo en 'sale_rent'.
  const [commModeR,   setCommModeR]   = useState<Modo>('pct')
  const [commissionR, setCommissionR] = useState<string | number>('')
  const [splitModeR,  setSplitModeR]  = useState<Modo>('pct')
  const [splitValueR, setSplitValueR] = useState<string | number>('')
  // El precio es de la propiedad y la base sobre la que se calcula la comisión.
  // El mantenimiento se edita en Características.
  const [price,      setPrice]      = useState<string | number>(prop.price ?? '')
  const [currency,   setCurrency]   = useState(prop.currency ?? 'USD')
  // Precio de alquiler. En 'sale_rent' vive en features (distinto de la venta).
  // En alquiler-solo el precio de display es properties.price, así que si no hay
  // rent_price se cae a él (si no, editar una propiedad de alquiler mostraría vacío
  // y guardar borraría el precio).
  const [rentPrice,  setRentPrice]  = useState<string | number>(
    prop.features?.rent_price || (prop.transaction === 'rent' ? String(prop.price ?? '') : ''))
  const [rentCurr,   setRentCurr]   = useState(
    prop.features?.rent_currency || (prop.transaction === 'rent' ? (prop.currency ?? 'USD') : 'USD'))
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (createClient() as any).from('contracts')
        .select('id,kind,start_date,end_date,duration_months,price,currency,commission,commission_type,commission_amount,split_type,split_value,commission_rent,commission_rent_type,commission_rent_amount,split_rent_type,split_rent_value,status,notes')
        .eq('property_id', prop.id).eq('active', true)
        .order('created_at', { ascending: false }).limit(1)
      if (cancelled) return
      const c = (data ?? [])[0] as Contract | undefined
      if (c) {
        setRow(c); setKind(c.kind ?? 'exclusiva')
        // La fecha de firma es el inicio; los meses vienen de la columna, o se
        // deducen del rango si es un contrato viejo sin ese dato.
        setFirmaDate(c.start_date ?? '')
        if (c.duration_months) setMeses(c.duration_months)
        else if (c.start_date && c.end_date) {
          const a = new Date(c.start_date + 'T12:00:00'), b = new Date(c.end_date + 'T12:00:00')
          const m = Math.round((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
          setMeses(Math.min(12, Math.max(1, m || 12)))
        }
        setNotes(c.notes ?? '')
        // Venta: columnas commission*/split*. Cada set se reabre en su modo.
        const cm: Modo = c.commission_type === 'amount' ? 'amount' : 'pct'
        setCommMode(cm); setCommission((cm === 'amount' ? c.commission_amount : c.commission) ?? '')
        const sm: Modo = c.split_type === 'amount' ? 'amount' : 'pct'
        setSplitMode(sm); setSplitValue(c.split_value ?? '')
        // Alquiler: columnas *_rent. Fallback: una propiedad de alquiler-solo
        // vieja guardó su comisión en las columnas de venta, así que si no hay
        // datos de alquiler y la transacción es alquiler, se leen de ahí.
        const legacyRent = prop.transaction === 'rent' && c.commission_rent == null && c.commission_rent_amount == null && c.split_rent_value == null
        const rType = legacyRent ? c.commission_type : c.commission_rent_type
        const rAmt  = legacyRent ? c.commission_amount : c.commission_rent_amount
        const rPct  = legacyRent ? c.commission : c.commission_rent
        const cmR: Modo = rType === 'amount' ? 'amount' : 'pct'
        setCommModeR(cmR); setCommissionR((cmR === 'amount' ? rAmt : rPct) ?? '')
        const rSType = legacyRent ? c.split_type : c.split_rent_type
        const rSVal  = legacyRent ? c.split_value : c.split_rent_value
        const smR: Modo = rSType === 'amount' ? 'amount' : 'pct'
        setSplitModeR(smR); setSplitValueR(rSVal ?? '')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [prop.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Negocio de venta (base precio de venta) y de alquiler (base precio de
  // alquiler). Cada uno a sus columnas; la transacción decide cuáles se guardan.
  const saleDeal = computeDeal(price, commMode, commission, splitMode, splitValue)
  const rentDeal = computeDeal(rentPrice, commModeR, commissionR, splitModeR, splitValueR)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    const sb = createClient()

    // Qué negocios aplican según la transacción.
    const esSale = prop.transaction === 'sale' || prop.transaction === 'sale_rent'
    const esRent = prop.transaction === 'rent' || prop.transaction === 'sale_rent'

    // 1. El precio va en la propiedad. El precio de alquiler vive en features
    //    (se mergea para no borrar el mantenimiento, que se edita en Características).
    const feat: Record<string, string> = { ...(prop.features ?? {}) }
    if (esRent) {
      feat.rent_price = String(rentPrice).trim()
      feat.rent_currency = rentCurr
    } else {
      feat.rent_price = ''; feat.rent_currency = ''
    }
    // El precio de display (lo que muestra el sitio) es el de venta, salvo
    // alquiler-solo, donde es el de alquiler.
    const displayPrice = prop.transaction === 'rent' ? rentDeal.priceNum : saleDeal.priceNum
    const displayCurr  = prop.transaction === 'rent' ? rentCurr : currency
    const { data: pData, error: pErr } = await sb.from('properties').update({
      price: displayPrice, currency: displayCurr, features: feat,
    }).eq('id', prop.id).select('*').single()
    if (pErr) { setSaveError(`Error: ${pErr.message}`); setSaving(false); return }

    // 2. El contrato: venta en columnas commission*/split*, alquiler en *_rent.
    //    Cada set se limpia si su negocio no aplica.
    const payload = {
      tenant_id: prop.tenant_id, property_id: prop.id,
      kind,
      start_date: firmaDate || null,
      end_date: firmaDate ? sumarMeses(firmaDate, meses) : null,
      duration_months: meses,
      price: displayPrice, currency: displayCurr,
      // commission se guarda como % y también el monto y el modo, para reabrir igual.
      commission:        esSale && saleDeal.commissionPct ? Math.round(saleDeal.commissionPct * 100) / 100 : null,
      commission_type:   commMode,
      commission_amount: esSale && saleDeal.commissionAmt ? Math.round(saleDeal.commissionAmt) : null,
      split_type:        splitMode,
      split_value:       esSale ? (saleDeal.splitInput || null) : null,
      commission_rent:        esRent && rentDeal.commissionPct ? Math.round(rentDeal.commissionPct * 100) / 100 : null,
      commission_rent_type:   commModeR,
      commission_rent_amount: esRent && rentDeal.commissionAmt ? Math.round(rentDeal.commissionAmt) : null,
      split_rent_type:        splitModeR,
      split_rent_value:       esRent ? (rentDeal.splitInput || null) : null,
      // El estado ya no se edita a mano (será automático con el sistema de
      // contratos/firma); se conserva el existente o arranca 'vigente'.
      status: row?.status ?? 'vigente', notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = sb as any
    const { data: cData, error: cErr } = row
      ? await sbAny.from('contracts').update(payload).eq('id', row.id).select('*').single()
      : await sbAny.from('contracts').insert(payload).select('*').single()
    if (cErr) { setSaveError(`Error en el contrato: ${cErr.message}`); setSaving(false); return }

    setRow(cData as Contract)
    onSaved(pData as PropertyFull)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p style={{ fontSize: 13, color: '#888', padding: '8px 2px' }}>Cargando contrato…</p>

  const venceDate = firmaDate ? sumarMeses(firmaDate, meses) : ''
  const dias = venceDate ? Math.round((new Date(venceDate + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
  const venceTxt = venceDate ? new Date(venceDate + 'T12:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const trans = prop.transaction || 'sale'
  const esVA = trans === 'sale_rent'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Precio y comisión van arriba: es lo que se define primero y lo que
          después alimenta el contrato. */}
      {esVA ? (
        <>
          <FormSection title="Venta — precio, comisión y negocio externo">
            <DealRow priceLabel="Precio de venta"
              price={price} setPrice={setPrice} currency={currency} setCurrency={setCurrency}
              commMode={commMode} setCommMode={setCommMode} commission={commission} setCommission={setCommission}
              splitMode={splitMode} setSplitMode={setSplitMode} splitValue={splitValue} setSplitValue={setSplitValue} />
          </FormSection>
          <FormSection title="Alquiler — precio, comisión y negocio externo">
            <DealRow priceLabel="Precio de alquiler"
              price={rentPrice} setPrice={setRentPrice} currency={rentCurr} setCurrency={setRentCurr}
              commMode={commModeR} setCommMode={setCommModeR} commission={commissionR} setCommission={setCommissionR}
              splitMode={splitModeR} setSplitMode={setSplitModeR} splitValue={splitValueR} setSplitValue={setSplitValueR} />
          </FormSection>
        </>
      ) : (
        <FormSection title="Precio, comisión y negocio externo">
          {trans === 'rent'
            ? <DealRow priceLabel="Precio de alquiler"
                price={rentPrice} setPrice={setRentPrice} currency={rentCurr} setCurrency={setRentCurr}
                commMode={commModeR} setCommMode={setCommModeR} commission={commissionR} setCommission={setCommissionR}
                splitMode={splitModeR} setSplitMode={setSplitModeR} splitValue={splitValueR} setSplitValue={setSplitValueR} />
            : <DealRow priceLabel="Precio de venta"
                price={price} setPrice={setPrice} currency={currency} setCurrency={setCurrency}
                commMode={commMode} setCommMode={setCommMode} commission={commission} setCommission={setCommission}
                splitMode={splitMode} setSplitMode={setSplitMode} splitValue={splitValue} setSplitValue={setSplitValue} />}
        </FormSection>
      )}

      <FormSection title="Contrato">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 4 }}>
          <div>
            <FieldLabel>Tipo de contrato</FieldLabel>
            <select value={kind} onChange={e => setKind(e.target.value)} style={inputSt}>
              {CONTRACT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Fecha de firma</FieldLabel>
            <input type="date" value={firmaDate} onChange={e => setFirmaDate(e.target.value)} style={inputSt} />
          </div>
          <div>
            <FieldLabel>Duración (meses)</FieldLabel>
            <select value={meses} onChange={e => setMeses(Number(e.target.value))} style={inputSt}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>
              ))}
            </select>
          </div>
        </div>
        {venceTxt && (
          <p style={{ fontSize: 12, margin: '8px 0 0', fontWeight: 600, color: dias != null && dias < 0 ? '#DC2626' : dias != null && dias <= 30 ? '#D97706' : '#059669' }}>
            Vence el {venceTxt}
            {dias != null && ` · ${dias < 0 ? `hace ${Math.abs(dias)} días` : dias === 0 ? 'hoy' : `en ${dias} días`}`}
          </p>
        )}
        <div style={{ marginTop: 16 }}>
          {/* Antes se llamaba "Notas". Va al contrato como cláusula, así que
              lleva el nombre de lo que es; las notas internas viven en su
              propio tab y no salen impresas. */}
          <FieldLabel>Acuerdos adicionales</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Condiciones particulares pactadas: exclusividad, plazos, gastos…"
            style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }} />
          <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>Este texto se incluye en el contrato.</p>
        </div>
      </FormSection>

      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
    {/* Los documentos generados no son parte del form de términos: se guardan
        solos al generar, así que van fuera del <form> para no dispararlo. */}
    <ContractDocs prop={prop} />
    </div>
  )
}

// Tab Archivos — repositorio de documentos de la propiedad. El informe
// registral y el plano catastrado (antes en Captación) viven en features;
// el resto en properties.doc_urls. Todo va al bucket privado property-docs y
// se sube al instante (auto-guarda), como Media.
function TabArchivos({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [informeUrl, setInformeUrl] = useState(prop.features?.informe_registral_url ?? '')
  const [planoUrl,   setPlanoUrl]   = useState(prop.features?.plano_catastrado_url ?? '')
  const [docs,       setDocs]       = useState<{ name: string; url: string }[]>(prop.doc_urls ?? [])
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [okMsg,      setOkMsg]      = useState<string | null>(null)
  const informeRef = useRef<HTMLInputElement>(null)
  const planoRef   = useRef<HTMLInputElement>(null)
  const genRef     = useRef<HTMLInputElement>(null)
  const flash = (m: string) => { setOkMsg(m); setTimeout(() => setOkMsg(null), 2000) }

  async function subir(file: File, name: string) {
    const ext = (file.name.split('.').pop() || 'dat').toLowerCase()
    const path = `${prop.tenant_id}/${prop.id}-${name}.${ext}`
    const { error } = await createClient().storage.from('property-docs').upload(path, file, { upsert: true })
    if (error) { setError(`No se pudo subir: ${error.message}`); return null }
    return createClient().storage.from('property-docs').getPublicUrl(path).data.publicUrl
  }

  // Informe / plano — la URL vive en features.
  async function subirFeature(file: File, name: string, key: string, setUrl: (u: string) => void) {
    setBusy(true); setError(null)
    const url = await subir(file, name)
    if (url) {
      const feat = { ...(prop.features ?? {}), [key]: url }
      const { data, error } = await createClient().from('properties').update({ features: feat }).eq('id', prop.id).select('*').single()
      if (error) setError(`Error: ${error.message}`)
      else { setUrl(url); onSaved(data as PropertyFull); flash('Archivo guardado') }
    }
    setBusy(false)
  }
  async function quitarFeature(key: string, setUrl: (u: string) => void) {
    setBusy(true); setError(null)
    const feat = { ...(prop.features ?? {}), [key]: '' }
    const { data, error } = await createClient().from('properties').update({ features: feat }).eq('id', prop.id).select('*').single()
    if (error) setError(`Error: ${error.message}`); else { setUrl(''); onSaved(data as PropertyFull) }
    setBusy(false)
  }

  // Archivos generales — properties.doc_urls.
  async function subirGenerales(files: FileList) {
    setBusy(true); setError(null)
    const sb = createClient()
    const nuevos = [...docs]
    for (const file of Array.from(files)) {
      const ext  = (file.name.split('.').pop() || 'dat').toLowerCase()
      const path = `${prop.tenant_id}/${prop.id}-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await sb.storage.from('property-docs').upload(path, file)
      if (error) { setError(`No se pudo subir ${file.name}: ${error.message}`); continue }
      nuevos.push({ name: file.name, url: sb.storage.from('property-docs').getPublicUrl(path).data.publicUrl })
    }
    const { data, error } = await sb.from('properties').update({ doc_urls: nuevos }).eq('id', prop.id).select('*').single()
    if (error) setError(`Error: ${error.message}`); else { setDocs(nuevos); onSaved(data as PropertyFull); flash('Archivos subidos') }
    setBusy(false)
    if (genRef.current) genRef.current.value = ''
  }
  async function quitarGeneral(url: string) {
    setBusy(true); setError(null)
    const nuevos = docs.filter(d => d.url !== url)
    const { data, error } = await createClient().from('properties').update({ doc_urls: nuevos }).eq('id', prop.id).select('*').single()
    if (error) setError(`Error: ${error.message}`); else { setDocs(nuevos); onSaved(data as PropertyFull) }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title="Documentos registrales">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FileUploadField label="Informe registral (PDF)" file={null}
            onSelect={f => subirFeature(f, 'informe-registral', 'informe_registral_url', setInformeUrl)}
            onClear={() => quitarFeature('informe_registral_url', setInformeUrl)}
            inputRef={informeRef} accept=".pdf" existingUrl={informeUrl || undefined} />
          <FileUploadField label="Plano catastrado (PDF / imagen)" file={null}
            onSelect={f => subirFeature(f, 'plano-catastrado', 'plano_catastrado_url', setPlanoUrl)}
            onClear={() => quitarFeature('plano_catastrado_url', setPlanoUrl)}
            inputRef={planoRef} accept=".pdf,image/*" existingUrl={planoUrl || undefined} />
        </div>
      </FormSection>

      <FormSection title={`Otros archivos (${docs.length})`}>
        <div onClick={() => genRef.current?.click()}
          {...dropProps(subirGenerales)}
          style={{ border: '2px dashed #e0e0e0', borderRadius: 10, padding: '18px 16px', cursor: 'pointer', textAlign: 'center', color: '#888', background: '#fff', transition: 'border-color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#6b2fa0')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}>
          <div style={{ fontSize: 22 }}>📎</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Clic para adjuntar o arrastrá los archivos acá — PDF, imágenes, documentos</div>
        </div>
        <input ref={genRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) subirGenerales(e.target.files) }} />
        {docs.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(d => (
              <div key={d.url} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #eceef1', borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <button type="button" onClick={() => abrirDocPrivado(d.url)} style={{ fontSize: 11, color: '#6b2fa0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Abrir</button>
                <button type="button" onClick={() => quitarGeneral(d.url)} style={{ fontSize: 11, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <div style={{ minHeight: 20 }}>
        {busy  && <span style={{ fontSize: 13, color: '#888' }}>Subiendo…</span>}
        {okMsg && <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>✓ {okMsg}</span>}
        {error && <span style={{ fontSize: 13, color: '#e53e3e' }}>{error}</span>}
      </div>
    </div>
  )
}

// Tab Notas — bitácora de la propiedad. Cada nota queda con fecha, hora y
// autor, y no se edita ni se borra: si algo quedó mal se agrega otra. Así el
// historial sirve como registro y no como borrador.
interface Nota {
  id: string; texto: string; autor_nombre: string | null; created_at: string
}

function TabNotas({ prop, onCount }: { prop: PropertyFull; onCount: (n: number) => void }) {
  const [notas,   setNotas]   = useState<Nota[]>([])
  const [texto,   setTexto]   = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await createClient().from('property_notes')
      .select('id,texto,autor_nombre,created_at')
      .eq('property_id', prop.id).order('created_at', { ascending: false })
    if (error) setError(`No se pudieron cargar las notas: ${error.message}`)
    else { setNotas((data ?? []) as Nota[]); onCount((data ?? []).length) }
    setLoading(false)
  }, [prop.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    setSaving(true); setError(null)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    // El nombre se copia acá: si el agente se va, la nota sigue diciendo
    // quién la escribió.
    const { data: yo } = await sb.from('users').select('name')
      .eq('auth_id', user?.id ?? '').eq('tenant_id', prop.tenant_id).maybeSingle()
    const { error } = await sb.from('property_notes').insert({
      tenant_id: prop.tenant_id, property_id: prop.id, texto: t,
      autor_id: user?.id ?? null,
      autor_nombre: (yo as { name: string } | null)?.name ?? user?.email ?? null,
    })
    if (error) { setError(`No se pudo guardar: ${error.message}`); setSaving(false); return }
    setTexto(''); setSaving(false)
    await cargar()
  }

  const cuando = (iso: string) => new Date(iso).toLocaleString('es-CR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title="Agregar nota">
        <form onSubmit={agregar}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4}
            placeholder="Qué pasó, qué se acordó, qué falta…"
            style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button type="submit" disabled={saving || !texto.trim()}
              style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: saving || !texto.trim() ? 'not-allowed' : 'pointer', opacity: saving || !texto.trim() ? 0.5 : 1 }}>
              {saving ? 'Guardando…' : 'Agregar nota'}
            </button>
            <span style={{ fontSize: 11, color: '#aaa' }}>Queda con tu nombre y la fecha. No se puede editar ni borrar.</span>
          </div>
          {error && <p style={{ fontSize: 12, color: '#e53e3e', margin: '10px 0 0' }}>{error}</p>}
        </form>
      </FormSection>

      <FormSection title={`Historial (${notas.length})`}>
        {loading
          ? <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Cargando…</p>
          : notas.length === 0
            ? <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>Sin notas todavía.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notas.map(n => (
                  <div key={n.id} style={{ border: '1px solid #eceef1', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{n.autor_nombre ?? 'Sistema'}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{cuando(n.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.texto}</div>
                  </div>
                ))}
              </div>
            )}
      </FormSection>
    </div>
  )
}

// Junta los datos de la propiedad para llenar una plantilla de contrato.
// Lee de varias tablas —agente, dueños, oficina, términos del contrato— y los
// arma en la forma que espera renderContrato.
async function armarDatosContrato(prop: PropertyFull): Promise<DatosContrato> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any
  const [{ data: tenant }, { data: agente }, { data: owners }, { data: con }] = await Promise.all([
    sb.from('tenants').select('name').eq('id', prop.tenant_id).maybeSingle(),
    prop.agent_id
      ? sb.from('users').select('name,cedula,email,phone,whatsapp').eq('id', prop.agent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('property_owners')
      .select('crm_contacts(name,last_name,cedula,email,phone,phone_country), crm_companies(name,cedula_juridica,email)')
      .eq('property_id', prop.id),
    sbAny.from('contracts')
      .select('start_date,end_date,duration_months,commission,commission_amount,notes')
      .eq('property_id', prop.id).eq('active', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Cada dueño puede ser persona o empresa; se arma una lista de campos y
  // luego se unen. Con varios dueños, cada campo queda separado por comas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filasDueno = ((owners ?? []) as any[]).map(o => {
    const c = o.crm_contacts, e = o.crm_companies
    return c
      ? { nombre: [c.name, c.last_name].filter(Boolean).join(' '), cedula: c.cedula, email: c.email,
          whatsapp: c.phone ? phoneDisplay(c.phone, c.phone_country) : null }
      : { nombre: e?.name ?? null, cedula: e?.cedula_juridica ?? null, email: e?.email ?? null, whatsapp: null }
  })
  const unir = (f: (x: typeof filasDueno[number]) => string | null | undefined) =>
    filasDueno.map(f).filter(Boolean).join(', ') || null

  const a = agente as { name?: string; cedula?: string; email?: string; phone?: string; whatsapp?: string } | null
  const c = con as { start_date?: string; end_date?: string; duration_months?: number; commission?: number; commission_amount?: number; notes?: string } | null

  return {
    propiedad: {
      titulo: prop.title || null, tipo: prop.type || null, transaccion: prop.transaction || null,
      precio: prop.price ?? null, moneda: prop.currency ?? null,
      provincia: prop.provincia, canton: prop.canton, distrito: prop.distrito, direccion: prop.address,
      finca: prop.finca_number, plano: prop.plano_number,
      area_m2: prop.area_m2, lote_m2: prop.lot_m2,
      habitaciones: prop.bedrooms, banos: prop.bathrooms,
    },
    contrato: {
      fecha_inicio: c?.start_date ?? null, fecha_vencimiento: c?.end_date ?? null,
      duracion_meses: c?.duration_months ?? null,
      comision_pct: c?.commission ?? null, comision_monto: c?.commission_amount ?? null,
      acuerdos: c?.notes ?? null,
    },
    oficina: { nombre: (tenant as { name?: string } | null)?.name ?? 'Noduus' },
    agente:  { nombre: a?.name ?? null, cedula: a?.cedula ?? null, email: a?.email ?? null, telefono: a?.phone ?? null, whatsapp: a?.whatsapp ?? null },
    duenos:         unir(x => x.nombre),
    dueno_cedula:   unir(x => x.cedula),
    dueno_email:    unir(x => x.email),
    dueno_whatsapp: unir(x => x.whatsapp),
  }
}

interface Plantilla { id: string; nombre: string; descripcion: string | null; cuerpo: string }
interface DocGenerado { id: string; nombre: string; cuerpo: string; autor_nombre: string | null; created_at: string }

// Documentos de contrato de la propiedad: se elige una plantilla, se genera con
// los datos ya metidos (texto congelado) y se baja como PDF. Se pueden agregar
// varios: captación, oferta, opción de compraventa…
function ContractDocs({ prop }: { prop: PropertyFull }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [docs,       setDocs]       = useState<DocGenerado[]>([])
  const [elegida,    setElegida]    = useState('')
  const [generando,  setGenerando]  = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [oficina,    setOficina]    = useState('')

  const cargar = useCallback(async () => {
    const sb = createClient()
    const [{ data: pl }, { data: dc }, { data: tn }] = await Promise.all([
      sb.from('contract_templates').select('id,nombre,descripcion,cuerpo')
        .eq('tenant_id', prop.tenant_id).eq('active', true).order('position'),
      sb.from('contract_documents').select('id,nombre,cuerpo,autor_nombre,created_at')
        .eq('property_id', prop.id).order('created_at', { ascending: false }),
      sb.from('tenants').select('name').eq('id', prop.tenant_id).maybeSingle(),
    ])
    setPlantillas((pl ?? []) as Plantilla[])
    setDocs((dc ?? []) as DocGenerado[])
    setOficina((tn as { name?: string } | null)?.name ?? 'Noduus')
    setLoading(false)
  }, [prop.id, prop.tenant_id])

  useEffect(() => { cargar() }, [cargar])

  async function generar() {
    const tpl = plantillas.find(p => p.id === elegida)
    if (!tpl) return
    setGenerando(true); setError(null)
    try {
      const datos = await armarDatosContrato(prop)
      const cuerpo = renderContrato(tpl.cuerpo, datos)   // texto ya resuelto, se congela
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      const { data: yo } = await sb.from('users').select('name')
        .eq('auth_id', user?.id ?? '').eq('tenant_id', prop.tenant_id).maybeSingle()
      const { error } = await sb.from('contract_documents').insert({
        tenant_id: prop.tenant_id, property_id: prop.id, template_id: tpl.id,
        nombre: tpl.nombre, cuerpo,
        autor_id: user?.id ?? null,
        autor_nombre: (yo as { name: string } | null)?.name ?? user?.email ?? null,
      })
      if (error) { setError(`No se pudo generar: ${error.message}`); return }
      setElegida('')
      await cargar()
    } finally { setGenerando(false) }
  }

  async function quitar(id: string) {
    const { error } = await createClient().from('contract_documents').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  function abrirPdf(d: DocGenerado) {
    imprimirContrato({
      titulo: d.nombre,
      oficina,
      cuerpo: d.cuerpo,
      fecha: new Date(d.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }),
    })
  }

  const cuando = (iso: string) => new Date(iso).toLocaleString('es-CR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <FormSection title={`Documentos de contrato (${docs.length})`}>
      {loading ? <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Cargando…</p> : (
        <>
          {plantillas.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              No hay tipos de contrato definidos. El administrador los crea en <strong>Administración › Contratos</strong>.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <FieldLabel>Generar un contrato</FieldLabel>
                <select value={elegida} onChange={e => setElegida(e.target.value)} style={inputSt}>
                  <option value="">Elegí un tipo…</option>
                  {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <button type="button" onClick={generar} disabled={!elegida || generando}
                style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: !elegida || generando ? 'not-allowed' : 'pointer', opacity: !elegida || generando ? .5 : 1, height: 38 }}>
                {generando ? 'Generando…' : 'Generar'}
              </button>
            </div>
          )}
          <p style={{ fontSize: 11, color: '#aaa', margin: '8px 0 0' }}>
            El contrato se llena con los datos de la propiedad y queda congelado. Si cambian los datos, generá uno nuevo.
          </p>

          {error && <p style={{ fontSize: 12, color: '#e53e3e', margin: '10px 0 0' }}>{error}</p>}

          {docs.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: '1px solid #eceef1', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12' }}>{d.nombre}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.autor_nombre ?? 'Sistema'} · {cuando(d.created_at)}</div>
                  </div>
                  <button type="button" onClick={() => abrirPdf(d)}
                    style={{ fontSize: 12, color: '#fff', background: 'var(--color-primary, #111)', border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    Descargar PDF
                  </button>
                  <button type="button" onClick={() => quitar(d.id)}
                    style={{ fontSize: 12, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </FormSection>
  )
}

function TabPortales() {
  return (
    <FormSection title="Portales inmobiliarios">
      <div style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
        <p style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 600, color: '#5a6070' }}>Pendiente de definir</p>
        <p style={{ fontSize: 13, margin: 0, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
          Falta decidir los portales concretos y si la publicación va por feed JSON/XML que ellos consumen,
          o por push a la API de cada uno.
        </p>
      </div>
    </FormSection>
  )
}

// Estado CRM editable desde el header — visible en todos los tabs, porque
// la etapa acompaña todo el proceso y no pertenece a ninguno en particular.
function StatusSelect({ value, statuses, onChange }: {
  value: string; statuses: CrmStatus[]; onChange: (v: string) => void
}) {
  const c = statusColor(value)
  return (
    <select value={value} onChange={e => onChange(e.target.value)} title="Estado CRM"
      style={{
        fontSize: 12, fontWeight: 700, padding: '4px 26px 4px 10px', borderRadius: 20,
        background: c.bg, color: c.color, border: `1px solid ${c.color}33`,
        fontFamily: 'inherit', cursor: 'pointer', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(c.color)}' stroke-width='3'><path d='m6 9 6 6 6-6'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
      }}>
      {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )
}

function statusColor(status: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    draft:       { bg: '#f3f4f6', color: '#6b7280' },
    captacion:   { bg: '#fef3c7', color: '#d97706' },
    preparacion: { bg: '#dbeafe', color: '#2563eb' },
    lista:       { bg: '#d1fae5', color: '#059669' },
    active:      { bg: '#d1fae5', color: '#059669' },
    bajo_oferta: { bg: '#ede9fe', color: '#7c3aed' },
    sold:        { bg: '#fce7f3', color: '#db2777' },
    archived:    { bg: '#f3f4f6', color: '#9ca3af' },
  }
  return map[status] ?? { bg: '#f3f4f6', color: '#6b7280' }
}
