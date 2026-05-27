'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { PageConfig } from '@/types'

// Predefined pages — cannot be deleted, only shown/hidden
const PREDEFINED_PAGES: PageConfig[] = [
  { slug: 'nosotros', title: 'Nosotros', visible: true, order: 1, custom: false },
  { slug: 'contacto', title: 'Contacto', visible: true, order: 2, custom: false },
  { slug: 'listar', title: 'Listar mi propiedad', visible: true, order: 3, custom: false },
  { slug: 'reclutamiento', title: 'Reclutamiento', visible: false, order: 4, custom: false },
]

function mergePagesConfig(saved: PageConfig[] | null): PageConfig[] {
  if (!saved || saved.length === 0) return PREDEFINED_PAGES

  // Merge: start from predefined, apply saved visibility/order
  const result: PageConfig[] = PREDEFINED_PAGES.map(pre => {
    const match = saved.find(s => s.slug === pre.slug)
    return match ? { ...pre, visible: match.visible, order: match.order } : pre
  })

  // Append custom pages that aren't in predefined
  const customPages = saved.filter(s => !PREDEFINED_PAGES.find(p => p.slug === s.slug))
  return [...result, ...customPages].sort((a, b) => a.order - b.order)
}

export default function PaginasPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [pages, setPages] = useState<PageConfig[]>([])

  // New custom page form
  const [newTitle, setNewTitle] = useState('')
  const [addingPage, setAddingPage] = useState(false)

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
        .select('pages_config')
        .eq('tenant_id', adminRec.tenant_id).single()
      setPages(mergePagesConfig((cfg?.pages_config as PageConfig[] | null) ?? null))
      setLoading(false)
    })
  }, [])

  function toggleVisible(slug: string) {
    setPages(prev => prev.map(p => p.slug === slug ? { ...p, visible: !p.visible } : p))
  }

  function moveUp(index: number) {
    if (index === 0) return
    setPages(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next.map((p, i) => ({ ...p, order: i + 1 }))
    })
  }

  function moveDown(index: number) {
    setPages(prev => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next.map((p, i) => ({ ...p, order: i + 1 }))
    })
  }

  function removePage(slug: string) {
    setPages(prev => prev.filter(p => p.slug !== slug).map((p, i) => ({ ...p, order: i + 1 })))
  }

  function addCustomPage() {
    if (!newTitle.trim()) return
    const slug = newTitle.trim().toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const exists = pages.find(p => p.slug === slug)
    if (exists) return
    const newPage: PageConfig = {
      slug,
      title: newTitle.trim(),
      visible: true,
      order: pages.length + 1,
      custom: true,
    }
    setPages(prev => [...prev, newPage])
    setNewTitle('')
    setAddingPage(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      pages_config: pages,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Páginas"
        desc="Controlá qué páginas son visibles en el menú y el orden en que aparecen"
      />
      <form onSubmit={save}>
        <Section title="Páginas del sitio">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 20 }}>
            Activá o desactivá páginas, y arrastrá para cambiar el orden. Las páginas predefinidas no se pueden eliminar.
          </p>

          {/* Page list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pages.map((page, index) => (
              <div key={page.slug} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fafafa', border: '1.5px solid #ebebeb',
                borderRadius: 10, padding: '10px 14px',
                opacity: page.visible ? 1 : 0.5,
                transition: 'opacity .15s',
              }}>
                {/* Order controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button type="button" onClick={() => moveUp(index)} disabled={index === 0}
                    style={arrowBtn}>▲</button>
                  <button type="button" onClick={() => moveDown(index)} disabled={index === pages.length - 1}
                    style={arrowBtn}>▼</button>
                </div>

                {/* Order number */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ccc', width: 18, textAlign: 'center' }}>
                  {index + 1}
                </div>

                {/* Title */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                    {page.title}
                    {page.custom && (
                      <span style={{ fontSize: 10, background: '#f0f0f0', color: '#888', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 500 }}>
                        personalizada
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>/{page.slug}</div>
                </div>

                {/* Visible toggle */}
                <button type="button" onClick={() => toggleVisible(page.slug)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    border: '1.5px solid',
                    borderColor: page.visible ? '#38a169' : '#e0e0e0',
                    background: page.visible ? '#f0fdf4' : '#fff',
                    color: page.visible ? '#38a169' : '#aaa',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {page.visible ? 'Visible' : 'Oculta'}
                </button>

                {/* Edit link */}
                <a href={`/admin/paginas/${page.slug}`}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    border: '1.5px solid #e0e0e0', background: '#fff', color: '#555',
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                  Editar →
                </a>

                {/* Delete (only custom) */}
                {page.custom && (
                  <button type="button" onClick={() => removePage(page.slug)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: '1px solid #fee2e2',
                      background: '#fff', color: '#e53e3e', cursor: 'pointer',
                      fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add custom page */}
          <div style={{ marginTop: 16 }}>
            {addingPage ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addCustomPage() }
                    if (e.key === 'Escape') { setAddingPage(false); setNewTitle('') }
                  }}
                  placeholder="Nombre de la página"
                  style={{ ...inputStyle, maxWidth: 260 }}
                />
                <button type="button" onClick={addCustomPage}
                  style={{ ...pillBtn, background: '#111', color: '#fff', borderColor: '#111' }}>
                  Agregar
                </button>
                <button type="button" onClick={() => { setAddingPage(false); setNewTitle('') }}
                  style={{ ...pillBtn, color: '#888', borderColor: '#e0e0e0' }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingPage(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1.5px dashed #d0d0d0', background: '#fff', color: '#888',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                + Agregar página personalizada
              </button>
            )}
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
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const arrowBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: '#bbb', padding: '1px 3px', lineHeight: 1 }
const pillBtn: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1.5px solid', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }
