'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const MAP_STYLES = [
  { value: 'mapbox://styles/mapbox/streets-v12',        label: 'Streets' },
  { value: 'mapbox://styles/mapbox/light-v11',           label: 'Light' },
  { value: 'mapbox://styles/mapbox/dark-v11',            label: 'Dark' },
  { value: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite' },
  { value: 'mapbox://styles/mapbox/outdoors-v12',        label: 'Outdoors' },
]

const FONT_HEADINGS = ['Playfair Display', 'Merriweather', 'Lora', 'Poppins', 'Raleway', 'Montserrat']
const FONT_BODIES   = ['Outfit', 'Inter', 'DM Sans', 'Nunito', 'Open Sans', 'Lato']

export default function BrandingPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6b2fa0')
  const [accentColor, setAccentColor] = useState('#f59e0b')
  const [fontHeading, setFontHeading] = useState('Playfair Display')
  const [fontBody, setFontBody] = useState('Outfit')
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const { data: tenant } = await supabase
        .from('tenants').select('logo_url, theme').eq('id', adminRec.tenant_id).single()
      if (tenant) {
        setLogoUrl(tenant.logo_url ?? '')
        setPrimaryColor(tenant.theme?.primaryColor ?? '#6b2fa0')
        setAccentColor(tenant.theme?.accentColor ?? '#f59e0b')
        setFontHeading(tenant.theme?.fontHeading ?? 'Playfair Display')
        setFontBody(tenant.theme?.fontBody ?? 'Outfit')
        setMapStyle(tenant.theme?.mapStyle ?? 'mapbox://styles/mapbox/streets-v12')
      }
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenants').update({
      logo_url: logoUrl || null,
      theme: { primaryColor, accentColor, fontHeading, fontBody, mapStyle },
    }).eq('id', tenantId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Branding" desc="Colores, logo y tipografía de tu inmobiliaria" />
      <form onSubmit={save}>

        <Section title="Logo">
          <Field label="URL del logo">
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://..." style={inputStyle} />
          </Field>
          {logoUrl && (
            <img src={logoUrl} alt="Logo preview"
              style={{ height: 48, objectFit: 'contain', marginTop: 8, borderRadius: 6, border: '1px solid #e5e5e5', padding: 6 }} />
          )}
        </Section>

        <Section title="Colores">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Field label="Color primario">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                  style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #e0e0e0', padding: 2, cursor: 'pointer' }} />
                <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: primaryColor }} />
            </Field>
            <Field label="Color de acento">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                  style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #e0e0e0', padding: 2, cursor: 'pointer' }} />
                <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: accentColor }} />
            </Field>
          </div>
        </Section>

        <Section title="Tipografía">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Field label="Fuente de títulos">
              <select value={fontHeading} onChange={e => setFontHeading(e.target.value)} style={selectStyle}>
                {FONT_HEADINGS.map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Fuente de cuerpo">
              <select value={fontBody} onChange={e => setFontBody(e.target.value)} style={selectStyle}>
                {FONT_BODIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Estilo del mapa">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {MAP_STYLES.map(s => (
              <button key={s.value} type="button" onClick={() => setMapStyle(s.value)} style={{
                padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                border: `2px solid ${mapStyle === s.value ? '#111' : '#e5e5e5'}`,
                background: mapStyle === s.value ? '#111' : '#fff',
                color: mapStyle === s.value ? '#fff' : '#444',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {s.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
            También podés pegar la URL completa de un estilo custom de Mapbox Studio.
          </p>
          <input value={mapStyle} onChange={e => setMapStyle(e.target.value)}
            placeholder="mapbox://styles/..." style={{ ...inputStyle, marginTop: 4 }} />
        </Section>

        <SaveBar saving={saving} saved={saved} />
      </form>
    </div>
  )
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function PageLoader() {
  return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>
}

function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>{title}</h1>
      <p style={{ fontSize: 14, color: '#888', margin: 0 }}>{desc}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
      <button type="submit" disabled={saving} style={{
        background: '#111', color: '#fff', border: 'none', borderRadius: 10,
        padding: '11px 24px', fontSize: 14, fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
      }}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, background: '#fff', cursor: 'pointer',
}
