'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { ZoneConfigItem } from '@/types'

const MAP_STYLES = [
  { value: 'mapbox://styles/mapbox/streets-v12',         label: 'Streets',  color: '#e8ddd0', desc: 'Calles, edificios y puntos de interés. El más completo para propiedades urbanas.' },
  { value: 'mapbox://styles/mapbox/light-v11',           label: 'Light',    color: '#f2f0ec', desc: 'Fondo claro y minimalista. Los markers de propiedades destacan sin distracción.' },
  { value: 'mapbox://styles/mapbox/dark-v11',            label: 'Dark',     color: '#1a1c23', desc: 'Fondo oscuro elegante. Perfecto para inmobiliarias premium o de nicho.' },
  { value: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satélite', color: '#3a5a3a', desc: 'Fotografía aérea real con calles superpuestas. Ideal para lotes y propiedades grandes.' },
  { value: 'mapbox://styles/mapbox/outdoors-v12',        label: 'Outdoors', color: '#d6e8cc', desc: 'Topografía y terreno natural. Para propiedades rurales, de playa o de montaña.' },
]

// Predefined zones included in every install
const PREDEFINED: ZoneConfigItem[] = [
  { label: 'Curridabat',  key: 'Curridabat',   enabled: true },
  { label: 'Tres Ríos',   key: 'La union',      enabled: true },
  { label: 'San Pedro',   key: 'Montes de Oca', enabled: true },
  { label: 'Escalante',   key: 'Escalante',     enabled: true,  center: [-84.06344934624333, 9.936704621817613, 15] },
  { label: 'Tibás',       key: 'Tibas',         enabled: true },
  { label: 'Moravia',     key: 'Moravia',       enabled: true },
  { label: 'Coronado',    key: 'Coronado',      enabled: true },
  { label: 'Escazú',      key: 'Escazu',        enabled: true },
  { label: 'Santa Ana',   key: 'Santa Ana',     enabled: true },
  { label: 'Rohrmoser',   key: 'Pavas',         enabled: true },
  { label: 'Nunciatura',  key: 'Nunciatura',    enabled: true,  center: [-84.10319412103462, 9.936022992526121, 15] },
  { label: 'La Garita',   key: 'La Garita',     enabled: true },
  { label: 'Cartago',     key: 'Cartago',       enabled: true },
  { label: 'Heredia',     key: 'Heredia',       enabled: true },
  { label: 'Alajuela',    key: 'Alajuela',      enabled: true },
]

function mergeZones(saved: ZoneConfigItem[] | null): ZoneConfigItem[] {
  if (!saved || saved.length === 0) return PREDEFINED.map(z => ({ ...z }))
  // Keep predefined in order, applying saved enabled state
  const result: ZoneConfigItem[] = PREDEFINED.map(pre => {
    const match = saved.find(s => s.key === pre.key && !s.custom)
    return match ? { ...pre, enabled: match.enabled } : pre
  })
  // Append custom zones from saved
  const customs = saved.filter(s => s.custom)
  return [...result, ...customs]
}

// ────────────────────────────────────────────────────────────
// Center picker — click on map to set map center
// ────────────────────────────────────────────────────────────
function CenterPicker({
  mapboxToken,
  defaultCenter,
  defaultZoom,
  onPick,
}: {
  mapboxToken: string
  defaultCenter: [number, number]
  defaultZoom: number
  onPick: (lng: number, lat: number, zoom: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let map: any

    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = mapboxToken

      map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultCenter,
        zoom: defaultZoom,
      })
      mapRef.current = map

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Place initial marker if coords are valid
      const [defLng, defLat] = defaultCenter
      if (defLng !== 0 && defLat !== 0) {
        const el = document.createElement('div')
        el.style.cssText = 'width:20px;height:20px;background:#111;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer'
        markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(defaultCenter)
          .addTo(map)
      }

      map.on('click', (e: any) => {
        const { lng, lat } = e.lngLat
        const zoom = Math.round(map.getZoom() * 10) / 10

        if (markerRef.current) markerRef.current.remove()
        const el = document.createElement('div')
        el.style.cssText = 'width:20px;height:20px;background:#111;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer'
        markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)

        onPick(lng, lat, zoom)
      })
    })()

    return () => { map?.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={containerRef}
      style={{ width: '100%', height: 320, borderRadius: 10, overflow: 'hidden', border: '1px solid #e0e0e0' }} />
  )
}

// ────────────────────────────────────────────────────────────
// Style preview — live map that re-renders on style change
// ────────────────────────────────────────────────────────────
function StylePreview({ mapboxToken, mapStyle }: { mapboxToken: string; mapStyle: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let map: any

    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = mapboxToken

      map = new mapboxgl.Map({
        container: containerRef.current!,
        style: mapStyle,
        center: [-84.0907, 9.9281],
        zoom: 12,
        interactive: false,
        attributionControl: false,
      })
    })()

    return () => { map?.remove() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle])

  return (
    <div style={{ margin: '16px 0' }}>
      <div style={{ fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
        Vista previa
      </div>
      <div ref={containerRef}
        style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden', border: '1px solid #e0e0e0' }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Zone picker mini-map
// ────────────────────────────────────────────────────────────
interface PickerProps {
  mapboxToken: string
  defaultCenter: [number, number]
  defaultZoom: number
  onConfirm: (zone: ZoneConfigItem) => void
  onCancel: () => void
}

function ZonePicker({ mapboxToken, defaultCenter, defaultZoom, onConfirm, onCancel }: PickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [pickedLng, setPickedLng] = useState<number | null>(null)
  const [pickedLat, setPickedLat] = useState<number | null>(null)
  const [pickedZoom, setPickedZoom] = useState<number>(defaultZoom)
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [labelTouched, setLabelTouched] = useState(false)
  const [keyTouched, setKeyTouched] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    let map: any

    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = mapboxToken

      map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultCenter,
        zoom: defaultZoom,
      })
      mapRef.current = map

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      map.on('click', (e: any) => {
        const { lng, lat } = e.lngLat
        const zoom = Math.round(map.getZoom() * 10) / 10
        setPickedLng(lng)
        setPickedLat(lat)
        setPickedZoom(zoom)

        if (markerRef.current) markerRef.current.remove()
        const el = document.createElement('div')
        el.style.cssText = 'width:20px;height:20px;background:#111;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer'
        markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)
      })
    })()

    return () => { map?.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLabelChange(v: string) {
    setLabel(v)
    setLabelTouched(true)
    if (!keyTouched) {
      setKey(v.toLowerCase()
        .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
        .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
        .replace(/[^a-z0-9 ]/g, '').trim())
    }
  }

  function handleConfirm() {
    if (!label.trim() || !key.trim() || pickedLng === null || pickedLat === null) return
    onConfirm({
      label: label.trim(),
      key: key.trim(),
      enabled: true,
      custom: true,
      center: [pickedLng, pickedLat, pickedZoom],
    })
  }

  const ready = label.trim() && key.trim() && pickedLng !== null

  return (
    <div style={{ border: '1.5px solid #e0e0e0', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
      {/* Map */}
      <div ref={containerRef} style={{ width: '100%', height: 300 }} />

      {/* Controls */}
      <div style={{ padding: '16px 18px', background: '#fafafa', borderTop: '1px solid #ebebeb' }}>
        {pickedLng === null ? (
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            📍 Hacé click en el mapa para marcar el centro de la zona
          </p>
        ) : (
          <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 12px' }}>
            Posición: {pickedLat!.toFixed(5)}, {pickedLng!.toFixed(5)} · Zoom {pickedZoom}
            &nbsp;·&nbsp;
            <button type="button" onClick={() => { setPickedLng(null); setPickedLat(null); markerRef.current?.remove(); markerRef.current = null }}
              style={{ fontSize: 12, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              Limpiar
            </button>
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Nombre del pill</label>
            <input value={label} onChange={e => handleLabelChange(e.target.value)}
              placeholder="Ej: Ciudad Colón" style={inputStyle} />
            <span style={{ fontSize: 11, color: '#bbb' }}>Texto visible en el filtro</span>
          </div>
          <div>
            <label style={labelStyle}>Término de búsqueda</label>
            <input value={key} onChange={e => { setKey(e.target.value); setKeyTouched(true) }}
              placeholder="Ej: Ciudad Colon" style={inputStyle} />
            <span style={{ fontSize: 11, color: '#bbb' }}>Se busca en ciudad / dirección</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleConfirm} disabled={!ready}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: ready ? '#111' : '#e0e0e0', color: ready ? '#fff' : '#aaa',
              border: 'none', cursor: ready ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>
            Agregar zona
          </button>
          <button type="button" onClick={onCancel}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, border: '1px solid #e0e0e0', background: '#fff', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────
type MapTab = 'config' | 'diseno' | 'zonas'

export default function MapaPage() {
  const [tab, setTab] = useState<MapTab>('config')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')

  // Map center / zoom / style
  const [lat, setLat] = useState('9.9281')
  const [lng, setLng] = useState('-84.0907')
  const [zoom, setZoom] = useState(12)
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12')
  const [autoLightPreset, setAutoLightPreset] = useState(false)

  // Zones
  const [zones, setZones] = useState<ZoneConfigItem[]>([])
  const [showPicker, setShowPicker] = useState(false)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const [{ data: cfg }, { data: tenantRow }] = await Promise.all([
        supabase.from('tenant_config')
          .select('map_center_lat, map_center_lng, map_zoom, zone_config')
          .eq('tenant_id', adminRec.tenant_id).single(),
        supabase.from('tenants').select('theme').eq('id', adminRec.tenant_id).single(),
      ])
      if (cfg) {
        if (cfg.map_center_lat) setLat(String(cfg.map_center_lat))
        if (cfg.map_center_lng) setLng(String(cfg.map_center_lng))
        if (cfg.map_zoom) setZoom(cfg.map_zoom)
        setZones(mergeZones(cfg.zone_config as ZoneConfigItem[] | null))
      } else {
        setZones(mergeZones(null))
      }
      if (tenantRow?.theme?.mapStyle) setMapStyle(tenantRow.theme.mapStyle)
      if (tenantRow?.theme?.autoLightPreset) setAutoLightPreset(true)
      setLoading(false)
    })
  }, [])

  function toggleZone(key: string) {
    setZones(prev => prev.map(z => z.key === key ? { ...z, enabled: !z.enabled } : z))
  }

  function removeZone(key: string) {
    setZones(prev => prev.filter(z => z.key !== key))
  }

  function addZone(zone: ZoneConfigItem) {
    setZones(prev => [...prev, zone])
    setShowPicker(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    // Merge mapStyle into existing theme (don't wipe other branding fields)
    const { data: tenantRow } = await supabase.from('tenants').select('theme').eq('id', tenantId).single()
    await supabase.from('tenants').update({
      theme: { ...(tenantRow?.theme ?? {}), mapStyle, autoLightPreset },
    }).eq('id', tenantId)
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      map_center_lat: parseFloat(lat),
      map_center_lng: parseFloat(lng),
      map_zoom: zoom,
      zone_config: zones,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const predefinedZones = zones.filter(z => !z.custom)
  const customZones = zones.filter(z => z.custom)
  const enabledCount = zones.filter(z => z.enabled).length

  if (loading) return <PageLoader />

  const TABS: { id: MapTab; label: string }[] = [
    { id: 'config', label: 'Configuración' },
    { id: 'diseno', label: 'Diseño' },
    { id: 'zonas',  label: 'Zonas' },
  ]

  return (
    <div>
      <PageHeader
        title="Mapa"
        desc="Centro, zoom, estilo visual y zonas de búsqueda rápida"
      />

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? '#111' : '#888', fontFamily: 'inherit',
            borderBottom: `2px solid ${tab === t.id ? '#111' : 'transparent'}`,
            marginBottom: -1, transition: 'color .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <style>{`
        .z-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;outline:none;cursor:pointer;}
        .z-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#111;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.25);cursor:pointer;}
        .z-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#111;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.25);cursor:pointer;}
      `}</style>

      <form onSubmit={save}>

        {/* ══ TAB: CONFIGURACIÓN ══ */}
        {tab === 'config' && (
          <>
            <Section title="Centro del mapa">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 14 }}>
                Hacé click en el mapa para fijar el punto de inicio. El mapa del sitio abrirá centrado aquí.
              </p>
              <CenterPicker
                mapboxToken={mapboxToken}
                defaultCenter={[parseFloat(lng) || -84.0907, parseFloat(lat) || 9.9281]}
                defaultZoom={zoom}
                onPick={(newLng, newLat, newZoom) => {
                  setLng(String(newLng))
                  setLat(String(newLat))
                  setZoom(newZoom)
                }}
              />
              {(lat && lng) && (
                <p style={{ fontSize: 12, color: '#aaa', margin: '10px 0 0' }}>
                  📍 {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)} · Zoom {zoom}
                </p>
              )}
            </Section>

            <Section title="Zoom inicial">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input
                  type="range" min={4} max={18} value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="z-slider"
                  style={{ flex: 1, background: `linear-gradient(to right,#111 0%,#111 ${((zoom-4)/(18-4)*100).toFixed(1)}%,#e0e0e0 ${((zoom-4)/(18-4)*100).toFixed(1)}%,#e0e0e0 100%)` }}
                />
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111', width: 32, textAlign: 'center' }}>{zoom}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bbb', marginTop: 8 }}>
                <span>4 — País</span><span>10 — Ciudad</span><span>14 — Barrio</span><span>18 — Calle</span>
              </div>
            </Section>
          </>
        )}

        {/* ══ TAB: DISEÑO ══ */}
        {tab === 'diseno' && (
          <>
            <Section title="Estilo del mapa">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                Define la apariencia visual del mapa. No afecta qué propiedades se muestran ni su ubicación.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MAP_STYLES.map(s => {
                  const active = mapStyle === s.value
                  return (
                    <button key={s.value} type="button" onClick={() => setMapStyle(s.value)} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                      borderRadius: 10, border: `2px solid ${active ? '#111' : '#eee'}`,
                      background: active ? '#111' : '#fff', cursor: 'pointer', textAlign: 'left',
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: s.color, flexShrink: 0, border: '1px solid rgba(0,0,0,.08)' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#fff' : '#111', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,.55)' : '#aaa' }}>{s.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <StylePreview mapboxToken={mapboxToken} mapStyle={mapStyle} />
            </Section>

            <Section title="Iluminación automática">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 4 }}>
                    Cambio de mapa según hora del día
                  </div>
                  <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
                    Activa un preset de luz diferente de mañana, tarde, atardecer y noche para que el mapa se vea natural a cualquier hora.
                    Solo funciona con los estilos Streets, Light y Outdoors.
                  </p>
                </div>
                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => setAutoLightPreset(v => !v)}
                  style={{
                    flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
                    background: autoLightPreset ? '#111' : '#e0e0e0',
                    position: 'relative', cursor: 'pointer', transition: 'background .2s', marginTop: 2,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: autoLightPreset ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                  }} />
                </button>
              </div>
              {autoLightPreset && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['🌅', 'Amanecer', '5–8h'], ['☀️', 'Día', '8–17h'], ['🌆', 'Atardecer', '17–20h'], ['🌙', 'Noche', '20–5h']].map(([icon, label, hours]) => (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                      borderRadius: 20, background: '#f4f4f4', border: '1px solid #ebebeb',
                      fontSize: 12, color: '#555',
                    }}>
                      <span>{icon}</span>
                      <span style={{ fontWeight: 500 }}>{label}</span>
                      <span style={{ color: '#bbb', fontSize: 11 }}>{hours}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ══ TAB: ZONAS ══ */}
        {tab === 'zonas' && (
          <>
            <Section title="Zonas predefinidas">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
                Activá o desactivá las zonas que querés mostrar como pills de búsqueda rápida en el mapa.
                {' '}<strong style={{ color: '#111' }}>{enabledCount} activas</strong>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {predefinedZones.map(z => (
                  <button key={z.key} type="button" onClick={() => toggleZone(z.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      borderRadius: 10, fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                      border: '1.5px solid', cursor: 'pointer', transition: 'all .15s',
                      borderColor: z.enabled ? '#111' : '#e8e8e8',
                      background: z.enabled ? '#111' : '#fff',
                      color: z.enabled ? '#fff' : '#999',
                    }}>
                    <span style={{ fontSize: 14 }}>{z.enabled ? '✓' : '○'}</span>
                    <span style={{ fontWeight: 500 }}>{z.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Zonas personalizadas">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
                Agregá zonas propias haciendo click en el mapa para definir el centro. Al activar el pill en el sitio, el mapa vuela a esa posición.
              </p>

              {customZones.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {customZones.map(z => (
                    <div key={z.key} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#fafafa', border: '1.5px solid #ebebeb', borderRadius: 10, padding: '10px 14px',
                    }}>
                      <button type="button" onClick={() => toggleZone(z.key)} style={{
                        width: 32, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: z.enabled ? '#38a169' : '#e0e0e0', position: 'relative', flexShrink: 0, transition: 'background .2s',
                      }}>
                        <span style={{
                          position: 'absolute', top: 2, left: z.enabled ? 14 : 2, width: 16, height: 16,
                          borderRadius: '50%', background: '#fff', transition: 'left .2s',
                        }} />
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{z.label}</div>
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>
                          Busca: &quot;{z.key}&quot;
                          {z.center && ` · ${z.center[1].toFixed(4)}, ${z.center[0].toFixed(4)} · zoom ${z.center[2]}`}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeZone(z.key)} style={{
                        width: 28, height: 28, borderRadius: 6, border: '1px solid #fee2e2',
                        background: '#fff', color: '#e53e3e', cursor: 'pointer',
                        fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {showPicker ? (
                <ZonePicker
                  mapboxToken={mapboxToken}
                  defaultCenter={[parseFloat(lng) || -84.09, parseFloat(lat) || 9.93]}
                  defaultZoom={zoom}
                  onConfirm={addZone}
                  onCancel={() => setShowPicker(false)}
                />
              ) : (
                <button type="button" onClick={() => setShowPicker(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1.5px dashed #d0d0d0', background: '#fff', color: '#888',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  + Agregar zona desde el mapa
                </button>
              )}
            </Section>
          </>
        )}

        <SaveBar saving={saving} saved={saved} />
      </form>
    </div>
  )
}

// ── UI helpers ───────────────────────────────────────────────
function PageLoader() { return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div> }
function PageHeader({ title, desc }: { title: string; desc: string }) {
  return <div style={{ marginBottom: 32 }}><h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>{title}</h1><p style={{ fontSize: 14, color: '#888', margin: 0 }}>{desc}</p></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>
}
function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}><button type="submit" disabled={saving} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}</div>
}
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 5 }
