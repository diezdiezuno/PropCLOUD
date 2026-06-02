'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getCantons, getDistricts } from '@/data/cr-divisions'
import type mapboxgl from 'mapbox-gl'

/* ── Constants ───────────────────────────────────────────────── */
const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']

const TRANSACTIONS = [
  { value: 'sale',      label: 'Venta' },
  { value: 'rent',      label: 'Alquiler' },
  { value: 'sale_rent', label: 'Venta y alquiler' },
]

const CRM_STATUSES = [
  { value: 'draft',       label: 'Borrador' },
  { value: 'captacion',   label: 'En captación' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'lista',       label: 'Lista para publicar' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD $' },
  { value: 'CRC', label: 'CRC ₡' },
]

/* ── Types ───────────────────────────────────────────────────── */
interface PropertyType { id: string; label: string; value: string; icon: string | null }
interface Agent        { id: string; name: string }

/* ── Component ───────────────────────────────────────────────── */
export default function NuevaPropiedadPage() {
  const router = useRouter()

  /* Auth */
  const [tenantId, setTenantId] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /* Reference data */
  const [propTypes, setPropTypes] = useState<PropertyType[]>([])
  const [agents,    setAgents]    = useState<Agent[]>([])

  /* ── SECTION 1: Datos básicos ── */
  const [propType,    setPropType]    = useState('')
  const [transaction, setTransaction] = useState('sale')
  const [crmStatus,   setCrmStatus]   = useState('captacion')
  const [agentId,     setAgentId]     = useState('')
  const [mandateType, setMandateType] = useState<'exclusive' | 'open' | ''>('')

  /* ── SECTION 2: Ubicación ── */
  const [provincia,  setProvincia]  = useState('')
  const [canton,     setCanton]     = useState('')
  const [distrito,   setDistrito]   = useState('')
  const [address,    setAddress]    = useState('')
  const [finca,      setFinca]      = useState('')
  const [plano,      setPlano]      = useState('')
  const [mapLat,     setMapLat]     = useState<number | null>(null)
  const [mapLng,     setMapLng]     = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  /* Cascading dropdowns */
  const cantons   = provincia ? getCantons(provincia)  : []
  const districts = (provincia && canton) ? getDistricts(provincia, canton) : []

  /* Mapbox */
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<mapboxgl.Map | null>(null)
  const markerRef       = useRef<mapboxgl.Marker | null>(null)

  /* ── Load data ── */
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)

      const [{ data: types }, { data: agentList }] = await Promise.all([
        supabase.from('property_types').select('id,label,value,icon').eq('tenant_id', adminRec.tenant_id).order('sort_order'),
        supabase.from('agents').select('id,name').eq('tenant_id', adminRec.tenant_id).eq('is_active', true).order('name'),
      ])

      setPropTypes((types ?? []) as PropertyType[])
      setAgents((agentList ?? []) as Agent[])
      if (types?.length) setPropType(types[0].value)
      setLoading(false)
    })
  }, [])

  /* ── Mapbox init ── */
  useEffect(() => {
    if (!mapContainerRef.current || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return
    let map: mapboxgl.Map

    import('mapbox-gl').then(({ default: mb }) => {
      import('mapbox-gl/dist/mapbox-gl.css').catch(() => {})
      mb.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
      map = new mb.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.0, 9.93], zoom: 10,
      })
      map.addControl(new mb.NavigationControl(), 'top-right')
      map.on('click', e => {
        const { lng, lat } = e.lngLat
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat])
        } else {
          markerRef.current = new mb.Marker({ color: '#6b2fa0', draggable: true })
            .setLngLat([lng, lat]).addTo(map)
          markerRef.current.on('dragend', () => {
            const p = markerRef.current!.getLngLat()
            setMapLng(Math.round(p.lng * 1e6) / 1e6)
            setMapLat(Math.round(p.lat * 1e6) / 1e6)
          })
        }
        setMapLng(Math.round(lng * 1e6) / 1e6)
        setMapLat(Math.round(lat * 1e6) / 1e6)
      })
      mapRef.current = map
    })
    return () => { if (map) map.remove() }
  }, [])

  const flyToLocation = useCallback((lng: number, lat: number) => {
    if (!mapRef.current) return
    import('mapbox-gl').then(({ default: mb }) => {
      mapRef.current!.flyTo({ center: [lng, lat], zoom: 16, duration: 1200 })
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      } else {
        markerRef.current = new mb.Marker({ color: '#6b2fa0', draggable: true })
          .setLngLat([lng, lat]).addTo(mapRef.current!)
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLngLat()
          setMapLng(Math.round(p.lng * 1e6) / 1e6)
          setMapLat(Math.round(p.lat * 1e6) / 1e6)
        })
      }
      setMapLng(Math.round(lng * 1e6) / 1e6)
      setMapLat(Math.round(lat * 1e6) / 1e6)
    })
  }, [])

  function useMyLocation() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => { flyToLocation(pos.coords.longitude, pos.coords.latitude); setGeoLoading(false) },
      ()  => setGeoLoading(false),
      { timeout: 8000 }
    )
  }

  /* ── Save (draft) ── */
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()

    const { data, error } = await supabase.from('properties').insert({
      tenant_id:    tenantId,
      source:       'manual',
      status:       crmStatus === 'active' ? 'active' : 'inactive',
      crm_status:   crmStatus,
      type:         propType,
      transaction:  transaction === 'sale_rent' ? 'sale' : transaction,
      mandate_type: mandateType || null,
      agent_id:     agentId || null,
      provincia:    provincia || null,
      canton:       canton    || null,
      distrito:     distrito  || null,
      address:      address   || null,
      lat:          mapLat,
      lng:          mapLng,
      finca_number: finca     || null,
      plano_number: plano     || null,
      price:        0,
      currency:     'USD',
      images:       [],
      title:        '',
    }).select('id').single()

    if (error) {
      setSaveError(`Error: ${error.message}`)
      setSaving(false)
      return
    }

    router.push(`/admin/inventario/${data.id}`)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => router.push('/admin/inventario')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0, fontFamily: 'inherit', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Inventario
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Nueva propiedad</h1>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Completá los datos de la propiedad. Podés guardar como borrador en cualquier momento.</p>
      </div>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── SECCIÓN 1: Datos básicos ── */}
        <FormSection title="Datos básicos">
          {/* Tipo de propiedad */}
          <FieldLabel>Tipo de propiedad</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {propTypes.map(t => (
              <button key={t.value} type="button" onClick={() => setPropType(t.value)}
                style={{
                  padding: '8px 16px', borderRadius: 100, border: '2px solid',
                  borderColor: propType === t.value ? '#111' : '#e0e0e0',
                  background: propType === t.value ? '#111' : '#fff',
                  color: propType === t.value ? '#fff' : '#555',
                  fontSize: 13, fontWeight: propType === t.value ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
                }}>
                {t.icon && <span>{t.icon}</span>} {t.label}
              </button>
            ))}
          </div>

          {/* Transacción */}
          <FieldLabel>Transacción</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {TRANSACTIONS.map(t => (
              <PillBtn key={t.value} active={transaction === t.value} onClick={() => setTransaction(t.value)}>
                {t.label}
              </PillBtn>
            ))}
          </div>

          {/* Tipo de mandato */}
          <FieldLabel>Tipo de mandato</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[{ value: 'exclusive', label: '🔒 Exclusivo' }, { value: 'open', label: '🔓 Abierto' }].map(m => (
              <PillBtn key={m.value} active={mandateType === m.value}
                onClick={() => setMandateType(prev => prev === m.value ? '' : m.value as 'exclusive' | 'open')}>
                {m.label}
              </PillBtn>
            ))}
          </div>

          {/* Estado CRM */}
          <FieldLabel>Estado</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {CRM_STATUSES.map(s => (
              <PillBtn key={s.value} active={crmStatus === s.value} onClick={() => setCrmStatus(s.value)}>
                {s.label}
              </PillBtn>
            ))}
          </div>

          {/* Agente asignado */}
          {agents.length > 0 && (
            <>
              <FieldLabel>Agente asignado</FieldLabel>
              <select value={agentId} onChange={e => setAgentId(e.target.value)} style={{ ...inputSt, maxWidth: 320 }}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </>
          )}
        </FormSection>

        {/* ── SECCIÓN 2: Ubicación ── */}
        <FormSection title="Ubicación">
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
                {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Dirección */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Dirección / señas exactas</FieldLabel>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Ej: 200m norte del parque, casa esquinera"
              style={inputSt} />
          </div>

          {/* Datos registrales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <FieldLabel>Número de finca</FieldLabel>
              <input value={finca} onChange={e => setFinca(e.target.value)} placeholder="Ej: 1-12345-000" style={inputSt} />
            </div>
            <div>
              <FieldLabel>Número de plano catastrado</FieldLabel>
              <input value={plano} onChange={e => setPlano(e.target.value)} placeholder="Ej: SJ-1234567-2010" style={inputSt} />
            </div>
          </div>

          {/* Mapa */}
          <FieldLabel>Ubicación en el mapa</FieldLabel>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px' }}>
            Hacé clic en el mapa para marcar la ubicación exacta.
          </p>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
            <div ref={mapContainerRef} style={{ height: 320, width: '100%' }} />
            <button type="button" onClick={useMyLocation} disabled={geoLoading}
              style={{
                position: 'absolute', top: 12, left: 12,
                background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
                padding: '7px 13px', fontSize: 12, fontWeight: 500,
                cursor: geoLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontFamily: 'inherit',
              }}>
              <span>{geoLoading ? '…' : '📍'}</span>
              {geoLoading ? 'Localizando…' : 'Mi ubicación'}
            </button>
          </div>
          {mapLat !== null && (
            <p style={{ fontSize: 11, color: '#888', margin: '8px 0 0' }}>✓ {mapLat}, {mapLng}</p>
          )}
        </FormSection>

        {/* Save */}
        {saveError && (
          <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#e53e3e' }}>
            {saveError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 8 }}>
          <button type="submit" disabled={saving}
            style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
            {saving ? 'Guardando…' : 'Guardar y continuar →'}
          </button>
          <button type="button" onClick={() => router.push('/admin/inventario')}
            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 10, padding: '11px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>
            Cancelar
          </button>
          <span style={{ fontSize: 12, color: '#bbb' }}>Las siguientes secciones (características, fotos, descripción) se completan en el paso siguiente.</span>
        </div>
      </form>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────── */
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
      style={{
        padding: '8px 18px', borderRadius: 100, border: '2px solid',
        borderColor: active ? '#111' : '#e0e0e0',
        background: active ? '#111' : '#fff',
        color: active ? '#fff' : '#555',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
      }}>
      {children}
    </button>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
