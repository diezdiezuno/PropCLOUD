'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const ALL_SECTIONS = [
  { key: 'gallery',     label: 'Galería de imágenes' },
  { key: 'info',        label: 'Título y ubicación' },
  { key: 'stats',       label: 'Habitaciones / Baños / m²' },
  { key: 'description', label: 'Descripción' },
  { key: 'map',         label: 'Mini mapa de ubicación' },
  { key: 'agent',       label: 'Tarjeta del agente' },
]

type ContactMode = 'agent' | 'office'
type DetailLayout = 'A' | 'B' | 'C' | 'D'

const LAYOUTS: { id: DetailLayout; label: string; desc: string; thumb: React.ReactNode }[] = [
  {
    id: 'A',
    label: 'Hero + Sidebar',
    desc: 'Hero a pantalla completa con overlay. Contenido izquierda, formulario sticky derecha.',
    thumb: (
      <div style={{ width: '100%', height: 64, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* hero bar */}
        <div style={{ height: 22, borderRadius: 3, background: 'linear-gradient(90deg,#c9b99a,#7a6050)', flexShrink: 0 }} />
        {/* body: left+right */}
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 4, borderRadius: 2, background: '#ddd' }} />
            <div style={{ height: 4, borderRadius: 2, background: '#ddd', width: '80%' }} />
            <div style={{ height: 4, borderRadius: 2, background: '#eee', width: '60%' }} />
            <div style={{ flex: 1, borderRadius: 2, background: '#f0f0f0', marginTop: 2 }} />
          </div>
          <div style={{ width: 28, background: '#f5f5f5', borderRadius: 3, flexShrink: 0 }} />
        </div>
      </div>
    ),
  },
  {
    id: 'B',
    label: 'Editorial',
    desc: 'Hero superior. Columna centrada con galería horizontal, texto y formulario al final.',
    thumb: (
      <div style={{ width: '100%', height: 64, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 20, borderRadius: 3, background: 'linear-gradient(90deg,#c9b99a,#7a6050)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '0 16px' }}>
          <div style={{ height: 3, borderRadius: 2, background: '#ddd', width: '70%' }} />
          <div style={{ height: 3, borderRadius: 2, background: '#ddd', width: '90%' }} />
          <div style={{ height: 3, borderRadius: 2, background: '#eee', width: '50%' }} />
          <div style={{ display: 'flex', gap: 3, width: '100%', flex: 1, marginTop: 2 }}>
            {[0,1,2].map(i => <div key={i} style={{ flex: 1, borderRadius: 2, background: '#f0f0f0' }} />)}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'C',
    label: 'Split screen',
    desc: 'Fotos a la izquierda con scroll. Información y formulario a la derecha fija. (actual)',
    thumb: (
      <div style={{ width: '100%', height: 64, display: 'flex', gap: 4 }}>
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ flex: 2, borderRadius: 3, background: 'linear-gradient(160deg,#c9b99a,#7a6050)' }} />
          <div style={{ flex: 1, borderRadius: 3, background: 'linear-gradient(160deg,#b8c8d4,#809aaa)' }} />
        </div>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 3, padding: 4, background: '#f8f8f8', borderRadius: 3 }}>
          <div style={{ height: 3, borderRadius: 2, background: '#ddd', width: '80%' }} />
          <div style={{ height: 3, borderRadius: 2, background: '#ddd', width: '60%' }} />
          <div style={{ flex: 1, borderRadius: 2, background: '#eee', marginTop: 4 }} />
        </div>
      </div>
    ),
  },
  {
    id: 'D',
    label: 'Inmersivo',
    desc: 'Secciones a ancho completo apiladas. Hero centrado, stats grandes, galería filmstrip.',
    thumb: (
      <div style={{ width: '100%', height: 64, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 20, borderRadius: 3, background: 'linear-gradient(90deg,#c9b99a,#6a5040)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
        </div>
        <div style={{ height: 10, borderRadius: 3, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 8, height: 4, borderRadius: 1, background: '#ddd' }} />)}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 3 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, borderRadius: 2, background: '#f0f0f0' }} />)}
        </div>
      </div>
    ),
  },
]

export default function DetallePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [detailLayout, setDetailLayout] = useState<DetailLayout>('C')
  const [sections, setSections] = useState<string[]>(['gallery', 'info', 'stats', 'description', 'agent'])
  const [contactMode, setContactMode] = useState<ContactMode>('agent')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const { data: cfg } = await supabase
        .from('tenant_config').select('detail_layout, detail_sections, detail_contact_mode')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg?.detail_layout) setDetailLayout(cfg.detail_layout as DetailLayout)
      if (cfg?.detail_sections) setSections(cfg.detail_sections)
      if (cfg?.detail_contact_mode) setContactMode(cfg.detail_contact_mode as ContactMode)
      setLoading(false)
    })
  }, [])

  function toggle(key: string) {
    setSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      detail_layout: detailLayout,
      detail_sections: sections,
      detail_contact_mode: contactMode,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Ficha de propiedad" desc="Layout y secciones que se muestran al ver una propiedad" />
      <form onSubmit={save}>

        {/* ── Layout selector ── */}
        <Section title="Layout de la ficha">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 20 }}>
            Elegí cómo se organiza visualmente la información de cada propiedad.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {LAYOUTS.map(({ id, label, desc, thumb }) => {
              const active = detailLayout === id
              return (
                <div
                  key={id}
                  onClick={() => setDetailLayout(id)}
                  style={{
                    border: `2px solid ${active ? '#111' : '#e5e5e5'}`,
                    borderRadius: 12, padding: 14, cursor: 'pointer',
                    background: active ? '#111' : '#fff',
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    borderRadius: 8, overflow: 'hidden', marginBottom: 12,
                    border: '1px solid #eee', padding: 10, background: '#fff',
                  }}>
                    {thumb}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: active ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: active ? '#fff' : '#999',
                    }}>{id}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: active ? '#fff' : '#111' }}>{label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.55)' : '#aaa', margin: 0, lineHeight: 1.5, paddingLeft: 30 }}>
                    {desc}
                  </p>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Contact mode ── */}
        <Section title="Modo de contacto">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Elegí cómo se muestra el CTA de contacto en cada propiedad.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              ['agent', 'Agente', 'Se muestra el nombre, foto y contacto del agente asignado a cada propiedad'],
              ['office', 'Oficina', 'Se muestra el WhatsApp y email de la oficina (configurados en Contacto)'],
            ] as const).map(([value, label, desc]) => {
              const active = contactMode === value
              return (
                <label key={value} onClick={() => setContactMode(value)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${active ? '#111' : '#e5e5e5'}`,
                  background: active ? '#111' : '#fff',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? '#fff' : '#ccc'}`,
                    flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#fff' : '#111', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.6)' : '#aaa' }}>{desc}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </Section>

        {/* ── Visible sections ── */}
        <Section title="Secciones visibles">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Activá o desactivá cada sección. El orden de arriba hacia abajo refleja el orden en la página.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ALL_SECTIONS.map(({ key, label }) => {
              const active = sections.includes(key)
              return (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  border: `1px solid ${active ? '#d1d5db' : '#f0f0f0'}`,
                  background: active ? '#fff' : '#fafafa', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 14, color: active ? '#111' : '#aaa', fontWeight: active ? 500 : 400 }}>
                    {label}
                  </span>
                  <div
                    onClick={() => toggle(key)}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: active ? '#111' : '#e0e0e0',
                      position: 'relative', transition: 'background .2s', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: active ? 23 : 3,
                      transition: 'left .2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </label>
              )
            })}
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
function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}><button type="submit" disabled={saving} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}</div>
}
