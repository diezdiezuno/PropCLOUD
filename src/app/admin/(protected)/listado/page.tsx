'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type View = 'grid' | 'list'
type Sort = 'price_asc' | 'price_desc' | 'newest'

export default function ListadoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [view, setView] = useState<View>('grid')
  const [cols, setCols] = useState(3)
  const [sort, setSort] = useState<Sort>('price_asc')

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
        .select('listing_view, listing_cols, listing_sort')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg) {
        if (cfg.listing_view) setView(cfg.listing_view as View)
        if (cfg.listing_cols) setCols(cfg.listing_cols)
        if (cfg.listing_sort) setSort(cfg.listing_sort as Sort)
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
      listing_view: view,
      listing_cols: cols,
      listing_sort: sort,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Visualización del listado" desc="Cómo se muestran las propiedades en /listings" />
      <form onSubmit={save}>

        <Section title="Vista">
          <div style={{ display: 'flex', gap: 12 }}>
            {([['grid', '⊞ Cuadrícula'], ['list', '≡ Lista']] as const).map(([v, label]) => (
              <Chip key={v} active={view === v} onClick={() => setView(v)}>{label}</Chip>
            ))}
          </div>
        </Section>

        <Section title="Columnas (vista cuadrícula)">
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
