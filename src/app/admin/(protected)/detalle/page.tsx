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

export default function DetallePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
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
        .from('tenant_config').select('detail_sections, detail_contact_mode')
        .eq('tenant_id', adminRec.tenant_id).single()
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
      detail_sections: sections,
      detail_contact_mode: contactMode,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Secciones del detalle" desc="Qué secciones se muestran en la página de cada propiedad" />
      <form onSubmit={save}>

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
