'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ── Listado ──────────────────────────────────────────────────
type View = 'grid' | 'list'
type Sort = 'price_asc' | 'price_desc' | 'newest'

const C = { img: 'linear-gradient(135deg,#c9b99a,#8a7060)', img2: 'linear-gradient(135deg,#b8c8d4,#7090a0)', line: '#ddd', lineFaint: '#eee' }

const ALL_VIEWS: { key: string; label: string; desc: string; thumb: React.ReactNode }[] = [
  {
    key: 'grid', label: 'Masonry', desc: 'Cuadrícula tipo Pinterest con alturas variables',
    thumb: (
      <div style={{ width: '100%', height: 72, display: 'flex', gap: 3 }}>
        {[[36,18,22],[20,32,16],[28,14,28],[16,26,20]].map((heights, col) => (
          <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {heights.map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 3, background: i % 2 === 0 ? C.img : C.img2, flexShrink: 0 }} />
            ))}
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'hover', label: 'Grid hover', desc: 'Cuadrícula uniforme con overlay al pasar el mouse',
    thumb: (
      <div style={{ width: '100%', height: 72, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 3 }}>
        {[C.img,C.img2,C.img,C.img2, C.img2,C.img,C.img2,C.img].map((bg, i) => (
          <div key={i} style={{ borderRadius: 3, background: bg, position: 'relative', overflow: 'hidden' }}>
            {i === 2 && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 3 }}>
                <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.8)', marginBottom: 2, width: '80%' }} />
                <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.5)', width: '55%' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'dual', label: 'Dual', desc: '2 columnas con imagen grande y datos al lado',
    thumb: (
      <div style={{ width: '100%', height: 72, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {[C.img, C.img2].map((bg, i) => (
          <div key={i} style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 36, background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 3, background: '#fff' }}>
              <div style={{ height: 3, borderRadius: 1, background: C.line, width: '80%' }} />
              <div style={{ height: 3, borderRadius: 1, background: C.lineFaint, width: '55%' }} />
              <div style={{ height: 3, borderRadius: 1, background: C.line, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'list', label: 'Lista', desc: 'Fila horizontal compacta',
    thumb: (
      <div style={{ width: '100%', height: 72, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[C.img, C.img2, C.img].map((bg, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', gap: 6, borderRadius: 4, overflow: 'hidden', border: '1px solid #eee', background: '#fff' }}>
            <div style={{ width: 40, background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center', paddingRight: 8 }}>
              <div style={{ height: 3, borderRadius: 1, background: C.line, width: '70%' }} />
              <div style={{ height: 3, borderRadius: 1, background: C.lineFaint, width: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
]
type ViewKey = typeof ALL_VIEWS[number]['key']

// ── Detalle ──────────────────────────────────────────────────
type ContactMode = 'agent' | 'office'
type DetailLayout = 'A' | 'B' | 'C' | 'D'

const LAYOUTS: { id: DetailLayout; label: string; desc: string; thumb: React.ReactNode }[] = [
  {
    id: 'A', label: 'Hero + Sidebar',
    desc: 'Hero a pantalla completa con overlay. Contenido izquierda, formulario sticky derecha.',
    thumb: (
      <div style={{ width: '100%', height: 64, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 22, borderRadius: 3, background: 'linear-gradient(90deg,#c9b99a,#7a6050)', flexShrink: 0 }} />
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
    id: 'B', label: 'Editorial',
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
    id: 'C', label: 'Split screen',
    desc: 'Fotos a la izquierda con scroll. Información y formulario a la derecha fija.',
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
    id: 'D', label: 'Inmersivo',
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

// ── Main page ─────────────────────────────────────────────────
type PropTab = 'listado' | 'detalle'

export default function PropiedadesPage() {
  const [tab, setTab] = useState<PropTab>('listado')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')

  // Listado state
  const [defaultView, setDefaultView] = useState<View>('grid')
  const [sort, setSort] = useState<Sort>('price_asc')
  const [enabledViews, setEnabledViews] = useState<ViewKey[]>(['grid', 'hover', 'dual', 'list'])

  // Detalle state
  const [detailLayout, setDetailLayout] = useState<DetailLayout>('C')
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
        .from('tenant_config')
        .select('listing_view, listing_sort, listing_views, detail_layout, detail_contact_mode')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg) {
        if (cfg.listing_view) setDefaultView(cfg.listing_view as View)
        if (cfg.listing_sort) setSort(cfg.listing_sort as Sort)
        if (cfg.listing_views?.length) {
          const validKeys = new Set(['grid', 'hover', 'dual', 'list'])
          const valid = (cfg.listing_views as string[]).filter(v => validKeys.has(v)) as ViewKey[]
          if (valid.length) setEnabledViews(valid)
        }
        if (cfg.detail_layout) setDetailLayout(cfg.detail_layout as DetailLayout)
        if (cfg.detail_contact_mode) setContactMode(cfg.detail_contact_mode as ContactMode)
      }
      setLoading(false)
    })
  }, [])

  function toggleView(key: ViewKey) {
    setEnabledViews(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        const next = prev.filter(k => k !== key)
        if (defaultView === key) setDefaultView(next[0] as View)
        return next
      }
      return [...prev, key]
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      listing_view: defaultView,
      listing_sort: sort,
      listing_views: enabledViews,
      detail_layout: detailLayout,
      detail_contact_mode: contactMode,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  const TABS: { id: PropTab; label: string }[] = [
    { id: 'listado', label: 'Listado' },
    { id: 'detalle', label: 'Detalle' },
  ]

  return (
    <div>
      <PageHeader title="Propiedades" desc="Visualización del listado y ficha de propiedad" />

      {/* Tabs */}
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

      <form onSubmit={save}>

        {/* ══ LISTADO ══ */}
        {tab === 'listado' && (
          <>
            <Section title="Vistas disponibles">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
                Activá las vistas que querés ofrecer en el toggle del listado. Al menos una debe estar activa.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {ALL_VIEWS.map(({ key, label, desc, thumb }) => {
                  const active = enabledViews.includes(key)
                  const isDefault = defaultView === key
                  return (
                    <div key={key} style={{
                      borderRadius: 12, padding: 14, border: `2px solid ${active ? '#111' : '#e5e5e5'}`,
                      background: '#fff', opacity: active ? 1 : 0.55, transition: 'opacity .15s, border-color .15s',
                    }}>
                      {/* Thumbnail */}
                      <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 12, border: '1px solid #eee', padding: 10, background: '#fafafa' }}>
                        {thumb}
                      </div>
                      {/* Toggle + label row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{label}</span>
                        <div onClick={() => toggleView(key)} style={{
                          width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                          background: active ? '#111' : '#e0e0e0',
                          position: 'relative', transition: 'background .2s', cursor: 'pointer',
                        }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 3, left: active ? 21 : 3,
                            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 10px', lineHeight: 1.4 }}>{desc}</p>
                      {active && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: '#666' }}>
                          <input type="radio" name="defaultView" checked={isDefault} onChange={() => setDefaultView(key as View)} style={{ accentColor: '#111' }} />
                          Vista por defecto
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="Ordenamiento por defecto">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {([
                  ['price_asc',  'Precio ↑'],
                  ['price_desc', 'Precio ↓'],
                  ['newest',     'Más reciente'],
                ] as const).map(([v, label]) => (
                  <Chip key={v} active={sort === v} onClick={() => setSort(v)}>{label}</Chip>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ══ DETALLE ══ */}
        {tab === 'detalle' && (
          <>
            <Section title="Layout de la ficha">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 20 }}>
                Elegí cómo se organiza visualmente la información de cada propiedad.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {LAYOUTS.map(({ id, label, desc, thumb }) => {
                  const active = detailLayout === id
                  return (
                    <div key={id} onClick={() => setDetailLayout(id)} style={{
                      border: `2px solid ${active ? '#111' : '#e5e5e5'}`,
                      borderRadius: 12, padding: 14, cursor: 'pointer',
                      background: active ? '#111' : '#fff',
                      transition: 'border-color .15s, background .15s',
                    }}>
                      <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 12, border: '1px solid #eee', padding: 10, background: '#fff' }}>
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

            <Section title="Modo de contacto">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
                Elegí cómo se muestra el CTA de contacto en cada propiedad.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  ['agent',  'Agente',  'Se muestra el nombre, foto y contacto del agente asignado a cada propiedad'],
                  ['office', 'Oficina', 'Se muestra el formulario de solicitud de información (sin datos del agente)'],
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
          </>
        )}

        <SaveBar saving={saving} saved={saved} />
      </form>
    </div>
  )
}

// ── UI helpers ───────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
      border: `2px solid ${active ? '#111' : '#e5e5e5'}`,
      background: active ? '#111' : '#fff', color: active ? '#fff' : '#555',
      cursor: 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  )
}
function PageLoader() { return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div> }
function PageHeader({ title, desc }: { title: string; desc: string }) {
  return <div style={{ borderLeft: '3px solid #111', paddingLeft: 14, marginBottom: 32 }}><h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.2 }}>{title}</h1><p style={{ fontSize: 14, color: '#888', margin: '5px 0 0' }}>{desc}</p></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>{children}</div>
}
function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}><button type="submit" disabled={saving} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}</div>
}
