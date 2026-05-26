'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function MapaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [lat, setLat] = useState('9.9281')
  const [lng, setLng] = useState('-84.0907')
  const [zoom, setZoom] = useState(12)

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
        .select('map_center_lat, map_center_lng, map_zoom')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg) {
        if (cfg.map_center_lat) setLat(String(cfg.map_center_lat))
        if (cfg.map_center_lng) setLng(String(cfg.map_center_lng))
        if (cfg.map_zoom) setZoom(cfg.map_zoom)
      }
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      map_center_lat: parseFloat(lat),
      map_center_lng: parseFloat(lng),
      map_zoom: zoom,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Configuración del mapa" desc="Centro inicial y zoom del mapa en la página principal" />
      <form onSubmit={save}>
        <Section title="Centro del mapa">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Abrí Google Maps, hace click derecho en el punto que querés centrar y copiá las coordenadas.
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
