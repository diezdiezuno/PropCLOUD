'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { PageConfig } from '@/types'
import PageHeader from '@/components/admin/PageHeader'

const PREDEFINED_PAGES: PageConfig[] = [
  { slug: 'nosotros',      title: 'Nosotros',             visible: true,  order: 1, custom: false },
  { slug: 'agentes',       title: 'Agentes',              visible: false, order: 2, custom: false },
  { slug: 'contacto',      title: 'Contacto',             visible: true,  order: 3, custom: false },
  { slug: 'listar',        title: 'Listar mi propiedad',  visible: true,  order: 4, custom: false },
  { slug: 'reclutamiento', title: 'Reclutamiento',        visible: false, order: 5, custom: false },
]

function mergePagesConfig(saved: PageConfig[] | null): PageConfig[] {
  if (!saved || saved.length === 0) return PREDEFINED_PAGES
  const result: PageConfig[] = PREDEFINED_PAGES.map(pre => {
    const match = saved.find(s => s.slug === pre.slug)
    return match ? { ...pre, visible: match.visible, order: match.order } : pre
  })
  const customPages = saved.filter(s => !PREDEFINED_PAGES.find(p => p.slug === s.slug))
  return [...result, ...customPages].sort((a, b) => a.order - b.order)
}

export default function PaginasPage() {
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [savedMsg,  setSavedMsg]  = useState(false)
  const [tenantId,  setTenantId]  = useState('')
  const [pages,     setPages]     = useState<PageConfig[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  // New page
  const [addingPage, setAddingPage] = useState(false)
  const [newTitle,   setNewTitle]   = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  // Iframe reload key
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const { data: cfg } = await supabase
        .from('tenant_config').select('pages_config').eq('tenant_id', adminRec.tenant_id).single()
      setPages(mergePagesConfig((cfg?.pages_config as PageConfig[] | null) ?? null))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (addingPage) setTimeout(() => newInputRef.current?.focus(), 50)
  }, [addingPage])

  /* ── Mutations ───────────────────────────────────────────── */

  function toggleVisible(slug: string) {
    setPages(prev => prev.map(p => p.slug === slug ? { ...p, visible: !p.visible } : p))
  }

  function moveLeft(index: number) {
    if (index === 0) return
    setPages(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next.map((p, i) => ({ ...p, order: i + 1 }))
    })
    setActiveIdx(index - 1)
  }

  function moveRight(index: number) {
    setPages(prev => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next.map((p, i) => ({ ...p, order: i + 1 }))
    })
    setActiveIdx(index + 1)
  }

  function removePage(slug: string) {
    const idx = pages.findIndex(p => p.slug === slug)
    setPages(prev => prev.filter(p => p.slug !== slug).map((p, i) => ({ ...p, order: i + 1 })))
    setActiveIdx(Math.max(0, idx - 1))
  }

  function addCustomPage() {
    if (!newTitle.trim()) return
    const slug = newTitle.trim().toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (pages.find(p => p.slug === slug)) return
    const newPage: PageConfig = { slug, title: newTitle.trim(), visible: true, order: pages.length + 1, custom: true }
    setPages(prev => [...prev, newPage])
    setActiveIdx(pages.length)
    setNewTitle('')
    setAddingPage(false)
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({ tenant_id: tenantId, pages_config: pages }, { onConflict: 'tenant_id' })
    setSaving(false); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 3000)
  }

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const activePage = pages[activeIdx] ?? pages[0]

  return (
    <div>
      {/* Header */}
      <PageHeader title="Páginas" subtitle="Seleccioná una página para ver su vista previa y opciones."
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedMsg && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}
            <button onClick={save} disabled={saving}
              style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        } />

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: '#f5f5f7', borderRadius: 12, padding: '5px 5px',
        marginBottom: 0, overflowX: 'auto',
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        border: '1px solid #e8e8e8', borderBottom: 'none',
      }}>
        {pages.map((page, i) => {
          const isActive = i === activeIdx
          return (
            <button
              key={page.slug}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap', flexShrink: 0,
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? '#111' : page.visible ? '#555' : '#bbb',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {!page.visible && <span style={{ fontSize: 9, opacity: .5 }}>●</span>}
              {page.title}
              {page.custom && (
                <span style={{ fontSize: 10, background: isActive ? '#f0f0f0' : 'transparent', color: '#bbb', borderRadius: 4, padding: '0 4px' }}>
                  ✦
                </span>
              )}
            </button>
          )
        })}

        {/* Add page button */}
        {!addingPage ? (
          <button
            onClick={() => setAddingPage(true)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1.5px dashed #d0d0d0',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              background: 'transparent', color: '#bbb',
              flexShrink: 0, lineHeight: 1,
              transition: 'all .15s',
            }}
            title="Agregar página personalizada"
          >
            +
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', flexShrink: 0 }}>
            <input
              ref={newInputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addCustomPage() }
                if (e.key === 'Escape') { setAddingPage(false); setNewTitle('') }
              }}
              placeholder="Nombre de la página"
              style={{
                border: '1px solid #e0e0e0', borderRadius: 6, padding: '6px 10px',
                fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 160,
              }}
            />
            <button type="button" onClick={addCustomPage}
              style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--color-primary, #111)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Crear
            </button>
            <button type="button" onClick={() => { setAddingPage(false); setNewTitle('') }}
              style={{ padding: '6px 10px', borderRadius: 6, background: 'none', color: '#888', border: '1px solid #e0e0e0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              ×
            </button>
          </div>
        )}
      </div>

      {/* Page panel */}
      {activePage && (
        <div style={{
          background: '#fff', border: '1px solid #e8e8e8',
          borderTopLeftRadius: 0, borderTopRightRadius: 0,
          borderRadius: '0 0 12px 12px', overflow: 'hidden',
        }}>
          {/* Controls bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa',
          }}>
            {/* Slug */}
            <span style={{ fontSize: 12, color: '#bbb', fontFamily: 'monospace', flexShrink: 0 }}>
              /{activePage.slug}
            </span>

            <div style={{ flex: 1 }} />

            {/* Order */}
            <button type="button" onClick={() => moveLeft(activeIdx)} disabled={activeIdx === 0}
              style={ctrlBtn(activeIdx === 0)} title="Mover a la izquierda">← Mover</button>
            <button type="button" onClick={() => moveRight(activeIdx)} disabled={activeIdx === pages.length - 1}
              style={ctrlBtn(activeIdx === pages.length - 1)} title="Mover a la derecha">Mover →</button>

            {/* Visible toggle */}
            <button type="button" onClick={() => toggleVisible(activePage.slug)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                borderColor: activePage.visible ? '#38a169' : '#e0e0e0',
                background: activePage.visible ? '#f0fdf4' : '#fff',
                color: activePage.visible ? '#38a169' : '#aaa',
              }}>
              {activePage.visible ? '● Visible' : '○ Oculta'}
            </button>

            {/* Edit */}
            <a href={`/admin/paginas/${activePage.slug}`}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: '1.5px solid #111', background: 'var(--color-primary, #111)', color: '#fff',
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              Editar contenido →
            </a>

            {/* Reload preview */}
            <button type="button" onClick={() => setIframeKey(k => k + 1)}
              style={{ ...ctrlBtn(false), padding: '5px 10px' }} title="Recargar vista previa">
              ↺
            </button>

            {/* Delete (custom only) */}
            {activePage.custom && (
              <button type="button" onClick={() => removePage(activePage.slug)}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid #fee2e2',
                  background: '#fff', color: '#e53e3e', cursor: 'pointer',
                  fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                ×
              </button>
            )}
          </div>

          {/* Iframe preview */}
          <iframe
            key={`${activePage.slug}-${iframeKey}`}
            src={`/${activePage.slug}`}
            style={{
              width: '100%', height: 680, border: 'none', display: 'block',
              background: '#f9f9fb',
            }}
            title={`Vista previa: ${activePage.title}`}
          />
        </div>
      )}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────── */
function ctrlBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    border: '1.5px solid #e0e0e0', background: '#fff',
    color: disabled ? '#ddd' : '#555', cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', flexShrink: 0,
  }
}
