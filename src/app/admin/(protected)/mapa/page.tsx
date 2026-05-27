'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Predefined zones — [label, searchKey, hint?]
const PREDEFINED_ZONES: [string, string, string?][] = [
  ['Curridabat', 'Curridabat'],
  ['Tres Ríos', 'La union', 'Busca: "La union"'],
  ['San Pedro', 'Montes de Oca', 'Busca: "Montes de Oca"'],
  ['Escalante', 'Escalante'],
  ['Tibás', 'Tibas', 'Busca: "Tibas"'],
  ['Moravia', 'Moravia'],
  ['Coronado', 'Coronado'],
  ['Escazú', 'Escazu', 'Busca: "Escazu"'],
  ['Santa Ana', 'Santa Ana'],
  ['Rohrmoser', 'Pavas', 'Busca: "Pavas"'],
  ['Nunciatura', 'Nunciatura'],
  ['La Garita', 'La Garita'],
  ['Cartago', 'Cartago'],
  ['Heredia', 'Heredia'],
  ['Alajuela', 'Alajuela'],
]

export default function MapaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')

  // Map center
  const [lat, setLat] = useState('9.9281')
  const [lng, setLng] = useState('-84.0907')
  const [zoom, setZoom] = useState(12)

  // Zone pills config: null = all enabled, array = specific enabled keys
  const [enabledZones, setEnabledZones] = useState<string[] | null>(null)
  const [showAllZones, setShowAllZones] = useState(true) // true = no filter (show all)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const { data: cfg } = await supabase
        .from('tenant_config')
        .select('map_center_lat, map_center_lng, map_zoom, zone_config')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg) {
        if (cfg.map_center_lat) setLat(String(cfg.map_center_lat))
        if (cfg.map_center_lng) setLng(String(cfg.map_center_lng))
        if (cfg.map_zoom) setZoom(cfg.map_zoom)
        if (cfg.zone_config === null || cfg.zone_config === undefined) {
          setShowAllZones(true)
          setEnabledZones(null)
        } else {
          setShowAllZones(false)
          setEnabledZones(cfg.zone_config as string[])
        }
      }
      setLoading(false)
    })
  }, [])

  function toggleZone(key: string) {
    if (showAllZones) return
    setEnabledZones(prev => {
      const current = prev ?? PREDEFINED_ZONES.map(z => z[1])
      if (current.includes(key)) return current.filter(k => k !== key)
      return [...current, key]
    })
  }

  function handleShowAllChange(val: boolean) {
    setShowAllZones(val)
    if (val) {
      setEnabledZones(null)
    } else {
      // Enable all by default when switching to custom
      setEnabledZones(PREDEFINED_ZONES.map(z => z[1]))
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      map_center_lat: parseFloat(lat),
      map_center_lng: parseFloat(lng),
      map_zoom: zoom,
      zone_config: showAllZones ? null : enabledZones,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const activeZoneKeys = showAllZones
    ? PREDEFINED_ZONES.map(z => z[1])
    : (enabledZones ?? [])

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Configuración del mapa"
        desc="Centro inicial, zoom y zonas de búsqueda rápida"
      />
      <form onSubmit={save}>

        {/* Centro del mapa */}
        <Section title="Centro del mapa">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Abrí Google Maps, hacé click derecho en el punto que querés centrar y copiá las coordenadas.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Field label="Latitud">
              <input value={lat} onChange={e => setLat(e.target.value)}
                placeholder="9.9281" style={inputStyle} />
            </Field>
            <Field label="Longitud">
              <input value={lng} onChange={e => setLng(e.target.value)}
                placeholder="-84.0907" style={inputStyle} />
            </Field>
          </div>
        </Section>

        {/* Zoom */}
        <Section title="Zoom inicial">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input type="range" min={4} max={18} value={zoom} onChange={e => setZoom(Number(e.target.value))}
              style={{ flex: 1 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111', width: 32, textAlign: 'center' }}>{zoom}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bbb', marginTop: 4 }}>
            <span>4 — País</span><span>10 — Ciudad</span><span>14 — Barrio</span><span>18 — Calle</span>
          </div>
        </Section>

        {/* Zonas de búsqueda */}
        <Section title="Zonas de búsqueda rápida">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Las zonas aparecen como pills en el filtro del mapa. Al hacer click, el mapa se centra en esa zona y filtra las propiedades.
          </p>

          {/* Toggle: todas vs personalizado */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { val: true, label: 'Mostrar todas' },
              { val: false, label: 'Personalizar' },
            ].map(({ val, label }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => handleShowAllChange(val)}
                style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                  border: '1.5px solid',
                  borderColor: showAllZones === val ? '#111' : '#e0e0e0',
                  background: showAllZones === val ? '#111' : '#fff',
                  color: showAllZones === val ? '#fff' : '#555',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Zone grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {PREDEFINED_ZONES.map(([label, key, hint]) => {
              const isActive = activeZoneKeys.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleZone(key)}
                  disabled={showAllZones}
                  title={hint}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', borderRadius: 10, fontSize: 13,
                    border: '1.5px solid',
                    borderColor: isActive ? '#111' : '#e8e8e8',
                    background: isActive ? (showAllZones ? '#f5f5f7' : '#111') : '#fff',
                    color: isActive ? (showAllZones ? '#555' : '#fff') : '#999',
                    cursor: showAllZones ? 'default' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
                    opacity: showAllZones ? 0.75 : 1,
                  }}
                >
                  <span style={{ fontSize: 15, lineHeight: 1 }}>
                    {isActive ? '✓' : '○'}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                    {hint && <span style={{ fontSize: 11, color: '#bbb', display: 'block', marginTop: 1 }}>{hint}</span>}
                  </span>
                </button>
              )
            })}
          </div>

          {!showAllZones && (
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 12, marginBottom: 0 }}>
              {activeZoneKeys.length} de {PREDEFINED_ZONES.length} zonas habilitadas
            </p>
          )}
        </Section>

        <SaveBar saving={saving} saved={saved} />
      </form>
    </div>
  )
}

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
