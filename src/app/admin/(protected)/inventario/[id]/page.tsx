'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getCantons, getDistricts } from '@/data/cr-divisions'
import type mapboxgl from 'mapbox-gl'
import ContactVCardModal, { type VCardViewType } from '../ContactVCardModal'
import NewOwnerModal, { type NewOwnerResult } from '../NewOwnerModal'

/* ── Constants ───────────────────────────────────────────────── */
const PROVINCIAS   = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']
const TRANSACTIONS = [{ value: 'sale', label: 'Venta' }, { value: 'rent', label: 'Alquiler' }, { value: 'sale_rent', label: 'Venta y alquiler' }]
const CRM_STATUSES = [
  { value: 'draft',       label: 'Borrador' },
  { value: 'captacion',   label: 'En captación' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'lista',       label: 'Lista para publicar' },
  { value: 'active',      label: 'Publicada' },
  { value: 'bajo_oferta', label: 'Bajo oferta' },
  { value: 'sold',        label: 'Vendida / Alquilada' },
  { value: 'archived',    label: 'Archivada' },
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
const TABS = [
  { id: 1, label: 'Captación',       icon: '📋' },
  { id: 2, label: 'Características', icon: '📐' },
  { id: 3, label: 'Amenidades',      icon: '✨' },
  { id: 4, label: 'Precio',          icon: '💰' },
  { id: 5, label: 'Descripción',     icon: '📝' },
  { id: 6, label: 'Fotos',           icon: '📸' },
  { id: 7, label: 'Estudios',        icon: '🔎' },
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
  video_url: string | null; images: string[]
  title: string; description_es: string | null; description_en: string | null
  features: Record<string, string> | null
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
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [agentId,   setAgentId]   = useState('')
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState(Number(searchParams.get('tab') ?? '1'))

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await sb.from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      const [{ data: p }, { data: types }, { data: agentList }] = await Promise.all([
        sb.from('properties').select('*').eq('id', id).eq('tenant_id', adminRec.tenant_id).single(),
        sb.from('property_types').select('id,label,value,icon').eq('tenant_id', adminRec.tenant_id).order('sort_order'),
        sb.from('agents').select('id,name').eq('tenant_id', adminRec.tenant_id).eq('is_active', true).order('name'),
      ])
      if (p) { setProp(p as PropertyFull); setAgentId((p as PropertyFull).agent_id ?? '') }
      setPropTypes((types ?? []) as PropertyType[])
      setAgents((agentList ?? []) as Agent[])
      setLoading(false)
    })
  }, [id])

  async function saveAgent(newId: string) {
    if (!prop) return
    setAgentId(newId)
    const { data } = await createClient().from('properties')
      .update({ agent_id: newId || null }).eq('id', prop.id).select('*').single()
    if (data) setProp(data as PropertyFull)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>
  if (!prop)   return <div style={{ padding: 40, color: '#e53e3e', fontSize: 14 }}>Propiedad no encontrada.</div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/inventario')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0, fontFamily: 'inherit', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Inventario
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>
              {prop.title || <span style={{ color: '#bbb', fontWeight: 400 }}>Sin título</span>}
            </h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {prop.provincia && <span style={{ fontSize: 13, color: '#888' }}>📍 {[prop.canton, prop.provincia].filter(Boolean).join(', ')}</span>}
              <StatusPill status={prop.crm_status} />
            </div>
          </div>
          {agents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Agente</span>
              <select value={agentId} onChange={e => saveAgent(e.target.value)}
                style={{ height: 34, padding: '0 10px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', maxWidth: 200 }}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #ebebeb', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '11px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
            borderBottom: activeTab === t.id ? '2px solid #111' : '2px solid transparent',
            marginBottom: -2, background: 'none', border: 'none',
            borderBottomStyle: 'solid',
            borderBottomWidth: 2,
            borderBottomColor: activeTab === t.id ? '#111' : 'transparent',
            color: activeTab === t.id ? '#111' : '#666',
            fontWeight: activeTab === t.id ? 600 : 400,
            fontSize: 13, fontFamily: 'inherit', transition: 'color .15s',
          }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            {t.id}. {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 1 && <Tab1Captacion    prop={prop} propTypes={propTypes} onSaved={setProp} />}
      {activeTab === 2 && <Tab2Caracteristicas prop={prop} onSaved={setProp} />}
      {activeTab === 3 && <Tab3Amenidades   prop={prop} onSaved={setProp} />}
      {activeTab === 4 && <Tab4Precio       prop={prop} onSaved={setProp} />}
      {activeTab === 5 && <Tab5Descripcion  prop={prop} onSaved={setProp} />}
      {activeTab === 6 && <Tab6Fotos        prop={prop} onSaved={setProp} />}
      {activeTab === 7 && <Tab7Estudios     prop={prop} />}
    </div>
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
  const [crmStatus,   setCrmStatus]   = useState(prop.crm_status ?? 'captacion')
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
  const [informeFile, setInformeFile] = useState<File | null>(null)
  const [planoFile,   setPlanoFile]   = useState<File | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)

  const mapContainerRef   = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<mapboxgl.Map | null>(null)
  const markerRef         = useRef<mapboxgl.Marker | null>(null)
  const informeInputRef   = useRef<HTMLInputElement>(null)
  const planoFileInputRef = useRef<HTMLInputElement>(null)

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
    async function uploadDoc(file: File, label: string) {
      const ext  = file.name.split('.').pop()
      const path = `${prop.tenant_id}/${prop.id}-${label}.${ext}`
      const { error } = await sb.storage.from('property-docs').upload(path, file, { upsert: true })
      if (error) return null
      return sb.storage.from('property-docs').getPublicUrl(path).data.publicUrl
    }
    const [informeUrl, planoDocUrl] = await Promise.all([
      informeFile ? uploadDoc(informeFile, 'informe-registral') : Promise.resolve(null),
      planoFile   ? uploadDoc(planoFile,   'plano-catastrado')  : Promise.resolve(null),
    ])
    const newFeatures = {
      ...(prop.features ?? {}),
      ...(informeUrl  ? { informe_registral_url: informeUrl }  : {}),
      ...(planoDocUrl ? { plano_catastrado_url: planoDocUrl }  : {}),
      ...(gmapsLink   ? { gmaps_link: gmapsLink }              : {}),
    }
    const { data, error } = await sb.from('properties').update({
      type:       propType,
      transaction: transaction,
      crm_status: crmStatus,
      status: crmStatus === 'active' ? 'active' : (crmStatus === 'sold' ? 'sold' : 'inactive'),
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

      {/* ── 1. Estado CRM ─────────────────────────────────── */}
      <FormSection title="Estado CRM">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CRM_STATUSES.map(s => (
            <PillBtn key={s.value} active={crmStatus === s.value} onClick={() => setCrmStatus(s.value)}>
              {s.label}
            </PillBtn>
          ))}
        </div>
      </FormSection>

      {/* ── 2. Datos básicos ──────────────────────────────── */}
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
              {t.icon && <span>{t.icon}</span>} {t.label}
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

        {/* Document uploads */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <FileUploadField label="Informe registral (PDF)" file={informeFile} onSelect={setInformeFile} onClear={() => setInformeFile(null)} inputRef={informeInputRef} accept=".pdf"
            existingUrl={prop.features?.informe_registral_url} />
          <FileUploadField label="Plano catastrado (PDF / imagen)" file={planoFile} onSelect={setPlanoFile} onClear={() => setPlanoFile(null)} inputRef={planoFileInputRef} accept=".pdf,image/*"
            existingUrl={prop.features?.plano_catastrado_url} />
        </div>

        <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 20px' }} />

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
            <span>{geoLoading ? '…' : '📍'}</span>{geoLoading ? 'Localizando…' : 'Mi ubicación'}
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

      {/* ── 4. Dueños ─────────────────────────────────────── */}
      <OwnerSection prop={prop} onSaved={onSaved} />

      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 2 — Características
══════════════════════════════════════════════════════════════ */
function Tab2Caracteristicas({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [bedrooms,   setBedrooms]   = useState(prop.bedrooms   ?? '')
  const [bathrooms,  setBathrooms]  = useState(prop.bathrooms  ?? '')
  const [areaM2,     setAreaM2]     = useState(prop.area_m2    ?? '')
  const [lotM2,      setLotM2]      = useState(prop.lot_m2     ?? '')
  const [parking,    setParking]    = useState(prop.parking    ?? '')
  const [floors,     setFloors]     = useState(prop.floors     ?? '')
  const [yearBuilt,  setYearBuilt]  = useState(prop.year_built ?? '')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    const { data, error } = await createClient().from('properties').update({
      bedrooms:   bedrooms   !== '' ? Number(bedrooms)  : null,
      bathrooms:  bathrooms  !== '' ? Number(bathrooms) : null,
      area_m2:    areaM2     !== '' ? Number(areaM2)    : null,
      lot_m2:     lotM2      !== '' ? Number(lotM2)     : null,
      parking:    parking    !== '' ? Number(parking)   : null,
      floors:     floors     !== '' ? Number(floors)    : null,
      year_built: yearBuilt  !== '' ? Number(yearBuilt) : null,
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <NumberField label="Habitaciones"  value={bedrooms}  onChange={setBedrooms}  placeholder="Ej: 3" icon="🛏️" />
          <NumberField label="Baños"         value={bathrooms} onChange={setBathrooms} placeholder="Ej: 2" icon="🚿" />
          <NumberField label="Parqueos"      value={parking}   onChange={setParking}   placeholder="Ej: 1" icon="🚗" />
          <NumberField label="Plantas / Pisos" value={floors}  onChange={setFloors}   placeholder="Ej: 2" icon="🏠" />
        </div>
      </FormSection>
      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 3 — Amenidades
══════════════════════════════════════════════════════════════ */
function Tab3Amenidades({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [selected, setSelected] = useState<string[]>(prop.amenities ?? [])
  const [custom,   setCustom]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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
    const { data, error } = await createClient().from('properties').update({ amenities: selected }).eq('id', prop.id).select('*').single()
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    onSaved(data as PropertyFull); setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title={`Amenidades seleccionadas (${selected.length})`}>
        {/* Preset checkboxes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {AMENITIES_LIST.map(a => {
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
        {/* Custom amenity */}
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
        {/* Custom chips */}
        {selected.filter(a => !AMENITIES_LIST.includes(a)).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {selected.filter(a => !AMENITIES_LIST.includes(a)).map(a => (
              <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500 }}>
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
   TAB 4 — Precio
══════════════════════════════════════════════════════════════ */
function Tab4Precio({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [price,        setPrice]        = useState<string | number>(prop.price ?? '')
  const [currency,     setCurrency]     = useState(prop.currency ?? 'USD')
  const [maintFee,     setMaintFee]     = useState(prop.features?.maintenance_fee ?? '')
  const [maintCurr,    setMaintCurr]    = useState(prop.features?.maintenance_currency ?? 'USD')
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)

  const priceNum = Number(String(price).replace(/,/g, ''))
  const areaM2   = prop.area_m2
  const pricePerM2 = (priceNum > 0 && areaM2 && areaM2 > 0) ? (priceNum / areaM2).toFixed(0) : null

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    const newFeatures = {
      ...(prop.features ?? {}),
      ...(maintFee ? { maintenance_fee: maintFee, maintenance_currency: maintCurr } : { maintenance_fee: '', maintenance_currency: '' }),
    }
    const { data, error } = await createClient().from('properties').update({
      price:    priceNum || 0,
      currency: currency,
      features: newFeatures,
    }).eq('id', prop.id).select('*').single()
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    onSaved(data as PropertyFull); setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title="Precio de venta / alquiler">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14, marginBottom: 8 }}>
          <div>
            <FieldLabel>Precio</FieldLabel>
            <input type="text" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="Ej: 150000" style={{ ...inputSt, fontSize: 22, fontWeight: 700, padding: '12px 14px' }} />
          </div>
          <div>
            <FieldLabel>Moneda</FieldLabel>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputSt, height: 50 }}>
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        {pricePerM2 && (
          <p style={{ fontSize: 12, color: '#6b2fa0', margin: '0 0 16px', fontWeight: 500 }}>
            ≈ {currency === 'USD' ? '$' : '₡'}{Number(pricePerM2).toLocaleString()} por m²
          </p>
        )}
        <div style={{ height: 1, background: '#f0f0f0', margin: '16px 0' }} />
        <FieldLabel>Cuota de mantenimiento (opcional)</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14 }}>
          <input type="text" inputMode="numeric" value={maintFee} onChange={e => setMaintFee(e.target.value)}
            placeholder="Ej: 80000" style={inputSt} />
          <select value={maintCurr} onChange={e => setMaintCurr(e.target.value)} style={inputSt}>
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>Se mostrará como información adicional en el sitio.</p>
      </FormSection>
      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 5 — Descripción
══════════════════════════════════════════════════════════════ */
function Tab5Descripcion({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [title,   setTitle]   = useState(prop.title ?? '')
  const [descEs,  setDescEs]  = useState(prop.description_es ?? '')
  const [descEn,  setDescEn]  = useState(prop.description_en ?? '')
  const [videoUrl, setVideoUrl] = useState(prop.video_url ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null); setSaved(false)
    const { data, error } = await createClient().from('properties').update({
      title:          title || '',
      description_es: descEs || null,
      description_en: descEn || null,
      video_url:      videoUrl || null,
    }).eq('id', prop.id).select('*').single()
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    onSaved(data as PropertyFull); setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSection title="Título y descripción">
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Título de la propiedad *</FieldLabel>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Casa en condominio con piscina en Escazú"
            style={{ ...inputSt, fontSize: 16, fontWeight: 600, padding: '12px 14px' }} />
          <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>Aparecerá como título en el sitio web.</p>
        </div>
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
        <div>
          <FieldLabel>URL de video (YouTube / Vimeo)</FieldLabel>
          <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={inputSt} />
        </div>
      </FormSection>
      <SaveBar saving={saving} saved={saved} error={saveError} />
    </form>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 6 — Fotos
══════════════════════════════════════════════════════════════ */
function Tab6Fotos({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
  const [images,    setImages]    = useState<string[]>(prop.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#6b2fa0' }}
          onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0' }}
          onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0'; if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
          style={{ border: '2px dashed #e0e0e0', borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, transition: 'border-color .15s', background: '#fafafa' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#6b2fa0'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0'}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? '⏳' : '📸'}</div>
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
                  <div style={{ position: 'absolute', top: 6, left: 6, background: '#111', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>PORTADA</div>
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
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 7 — Estudios (registral y mercado, generados por los agentes AIre)
══════════════════════════════════════════════════════════════ */
interface Estudio {
  id: string
  tipo: 'registral' | 'mercado' | string
  resultado: 'limpio' | 'revisar' | 'problema' | null
  resumen: string | null
  pdf_path: string | null
  precio_min: number | null
  precio_max: number | null
  precio_sugerido: number | null
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
      .select('id,tipo,resultado,resumen,pdf_path,precio_min,precio_max,precio_sugerido,created_at')
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
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔎</div>
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

            {/* Resumen */}
            {e.resumen && (
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#444', margin: 0, whiteSpace: 'pre-wrap' }}>{e.resumen}</p>
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

/* ══════════════════════════════════════════════════════════════
   OWNER SECTION — Información del dueño
══════════════════════════════════════════════════════════════ */
function OwnerSection({ prop, onSaved }: { prop: PropertyFull; onSaved: (p: PropertyFull) => void }) {
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

  // Load existing owners on mount — supports both new array format and legacy single owner
  // Also re-fetches linkedContacts for companies to always have fresh photo_url
  useEffect(() => {
    const f = prop.features
    if (!f) return

    let initial: OwnerResult[] = []
    if (f.owners) {
      try { initial = JSON.parse(f.owners) } catch { /* ignore */ }
    } else if (f.owner_id && f.owner_type && f.owner_name) {
      initial = [{ type: f.owner_type as 'contact' | 'company', id: f.owner_id, name: f.owner_name, subtitle: f.owner_subtitle ?? '' }]
    }
    if (!initial.length) return

    // Set immediately so names appear without waiting
    setOwners(initial)

    // Re-fetch linkedContacts for company owners to get fresh photo_url
    const companyOwners = initial.filter(o => o.type === 'company')
    if (!companyOwners.length) return
    Promise.all(
      companyOwners.map(async o => ({ id: o.id, linkedContacts: await fetchLinkedContacts(o.id) }))
    ).then(updates => {
      setOwners(prev => prev.map(o => {
        const u = updates.find(x => x.id === o.id)
        return u ? { ...o, linkedContacts: u.linkedContacts } : o
      }))
    })
  }, [prop.features]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function saveOwners(updated: OwnerResult[]) {
    const base = { ...(prop.features ?? {}) } as Record<string, string>
    const { owner_id: _a, owner_type: _b, owner_name: _c, owner_subtitle: _d, ...rest } = base
    const newFeatures = { ...rest, owners: JSON.stringify(updated) }
    const { data, error } = await createClient().from('properties').update({ features: newFeatures }).eq('id', prop.id).select('*').single()
    if (!error && data) onSaved(data as PropertyFull)
  }

  async function addOwner(o: OwnerResult) {
    if (owners.some(x => x.id === o.id)) return
    // If company, fetch linked contacts automatically
    const enriched: OwnerResult = o.type === 'company'
      ? { ...o, linkedContacts: await fetchLinkedContacts(o.id) }
      : o
    const updated = [...owners, enriched]
    setOwners(updated); setDropOpen(false); setQuery(''); setResults([]); setNoResults(false)
    await saveOwners(updated)
  }

  async function removeOwner(id: string) {
    const updated = owners.filter(o => o.id !== id)
    setOwners(updated)
    await saveOwners(updated)
  }

  async function search(q: string) {
    if (q.trim().length < 2) { setResults([]); setNoResults(false); return }
    setSearching(true); setNoResults(false)
    const sb   = createClient()
    const term = `%${q.trim()}%`
    const tid  = prop.tenant_id
    const [{ data: contacts }, { data: companies }] = await Promise.all([
      sb.from('crm_contacts').select('id,name,last_name,cedula,email').eq('tenant_id', tid)
        .or(`name.ilike.${term},last_name.ilike.${term},cedula.ilike.${term}`).limit(5),
      sb.from('crm_companies').select('id,name,trade_name,cedula_juridica').eq('tenant_id', tid)
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
        {owners.length > 0 ? 'Podés agregar más dueños buscando abajo.' : 'Escribí 2 caracteres para buscar en clientes y empresas del CRM.'}
      </p>

    </FormSection>

    {inlineView && <ContactVCardModal view={inlineView} onClose={() => setInlineView(null)} />}
    {newOwnerType && (
      <NewOwnerModal
        type={newOwnerType}
        tenantId={prop.tenant_id}
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
function FileUploadField({ label, file, onSelect, onClear, inputRef, accept, existingUrl }: {
  label: string; file: File | null; onSelect: (f: File) => void; onClear: () => void
  inputRef: React.RefObject<HTMLInputElement | null>; accept: string; existingUrl?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div onClick={() => inputRef.current?.click()}
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
              : <div style={{ fontSize: 13, color: '#aaa' }}>Clic para adjuntar</div>
          }
        </div>
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
        style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit', transition: 'opacity .15s' }}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {saved  && <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>✓ Guardado</span>}
      {error  && <span style={{ fontSize: 13, color: '#e53e3e' }}>{error}</span>}
    </div>
  )
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:       { label: 'Borrador',            bg: '#f3f4f6', color: '#6b7280' },
    captacion:   { label: 'En captación',        bg: '#fef3c7', color: '#d97706' },
    preparacion: { label: 'En preparación',      bg: '#dbeafe', color: '#2563eb' },
    lista:       { label: 'Lista para publicar', bg: '#d1fae5', color: '#059669' },
    active:      { label: 'Publicada',           bg: '#d1fae5', color: '#059669' },
    bajo_oferta: { label: 'Bajo oferta',         bg: '#ede9fe', color: '#7c3aed' },
    sold:        { label: 'Vendida',             bg: '#fce7f3', color: '#db2777' },
    archived:    { label: 'Archivada',           bg: '#f3f4f6', color: '#9ca3af' },
  }
  const s = map[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
}
