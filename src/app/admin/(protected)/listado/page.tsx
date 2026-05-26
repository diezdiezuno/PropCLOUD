'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type View = 'grid' | 'list'
type Sort = 'price_asc' | 'price_desc' | 'newest'

const ALL_VIEWS = [
  { key: 'grid',  label: '⊞ Masonry',    desc: 'Cuadrícula tipo Pinterest' },
  { key: 'hover', label: '⬛ Grid hover', desc: 'Cuadrícula uniforme con overlay' },
  { key: 'dual',  label: '▌▐ Dual',       desc: '2 columnas con imagen grande' },
  { key: 'list',  label: '≡ Lista',       desc: 'Fila horizontal compacta' },
] as const

type ViewKey = typeof ALL_VIEWS[number]['key']

export default function ListadoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [defaultView, setDefaultView] = useState<View>('grid')
  const [cols, setCols] = useState(3)
  const [sort, setSort] = useState<Sort>('price_asc')
  const [enabledViews, setEnabledViews] = useState<ViewKey[]>(['grid', 'hover', 'dual', 'list'])

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
        .select('listing_view, listing_cols, listing_sort, listing_views')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg) {
        if (cfg.listing_view) setDefaultView(cfg.listing_view as View)
        if (cfg.listing_cols) setCols(cfg.listing_cols)
        if (cfg.listing_sort) setSort(cfg.listing_sort as Sort)
        if (cfg.listing_views?.length) setEnabledViews(cfg.listing_views as ViewKey[])
      }
      setLoading(false)
    })
  }, [])

  function toggleView(key: ViewKey) {
    setEnabledViews(prev => {
      if (prev.includes(key)) {
        // Keep at least one enabled
        if (prev.length === 1) return prev
        const next = prev.filter(k => k !== key)
        // If we're disabling the current default, reset to first remaining
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
      listing_cols: cols,
      listing_sort: sort,
      listing_views: enabledViews,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Visualización del listado" desc="Cómo se muestran las propiedades en /listings" />
      <form onSubmit={save}>

        <Section title="Vistas disponibles">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Elegí qué modos de visualización se muestran en el toggle del listado. Al menos uno debe estar activo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ALL_VIEWS.map(({ key, label, desc }) => {
              const active = enabledViews.includes(key)
              const isDefault = defaultView === key
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  border: `1px solid ${active ? '#d1d5db' : '#f0f0f0'}`,
                  background: active ? '#fff' : '#fafafa',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Toggle */}
                    <div
                      onClick={() => toggleView(key)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: active ? '#111' : '#e0e0e0',
                        position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0,
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
                    <div>
                      <div style={{ fontSize: 14, color: active ? '#111' : '#aaa', fontWeight: active ? 500 : 400 }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                  {/* Default radio */}
                  {active && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                      <input
                        type="radio"
                        name="defaultView"
                        checked={isDefault}
                        onChange={() => setDefaultView(key as View)}
                        style={{ accentColor: '#111' }}
                      />
                      Por defecto
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Columnas (vista masonry)">
          <div style={{ display: 'flex', gap: 12 }}>
            {[2, 3, 4].map(n => (
              <Chip key={n} active={cols === n} onClick={() => setCols(n)}>{n} columnas</Chip>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#bbb', margin: '10px 0 0' }}>En mobile siempre se muestra 1 columna.</p>
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

        <SaveBar saving={saving} saved={saved} />
      </form>
    </div>
  )
}

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
  return <div style={{ marginBottom: 32 }}><h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>{title}</h1><p style={{ fontSize: 14, color: '#888', margin: 0 }}>{desc}</p></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>{children}</div>
}
function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}><button type="submit" disabled={saving} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}</div>
}
