'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// Búsqueda global del topbar: filtro por tipo, resultados agrupados por
// sección y panel de resumen a la derecha (sin abrir la ficha completa).

type Scope = 'all' | 'contact' | 'company' | 'property'
type Kind = 'contact' | 'company' | 'property'
interface SearchResult { type: Kind; id: string; title: string; subtitle: string; href: string }

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all',      label: 'Todo'        },
  { key: 'contact',  label: 'Contactos'   },
  { key: 'company',  label: 'Empresas'    },
  { key: 'property', label: 'Propiedades' },
]
const SECTION: Record<Kind, string> = { contact: 'Contactos', company: 'Empresas', property: 'Propiedades' }
const ICONS:   Record<Kind, string> = { contact: '👤', company: '🏢', property: '🏘️' }
const ORDER: Kind[] = ['contact', 'company', 'property']

export default function GlobalSearch({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [query,     setQuery]     = useState('')
  const [scope,     setScope]     = useState<Scope>('all')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [results,   setResults]   = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open,      setOpen]      = useState(false)
  const [preview,   setPreview]   = useState<{ r: SearchResult; data: Record<string, unknown> } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const rootRef  = useRef<HTMLDivElement>(null)
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cerrar al hacer click afuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setScopeOpen(false); setPreview(null) }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Cmd+K / Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true) }
      if (e.key === 'Escape') { setOpen(false); setScopeOpen(false); setPreview(null) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const runSearch = useCallback(async (q: string, sc: Scope) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    const sb = createClient()
    const term = `%${q.trim()}%`
    const want = (k: Kind) => sc === 'all' || sc === k

    const [contacts, companies, props] = await Promise.all([
      want('contact')
        ? sb.from('crm_contacts').select('id, name, last_name, email, cedula').eq('tenant_id', tenantId)
            .or(`name.ilike.${term},last_name.ilike.${term},email.ilike.${term},cedula.ilike.${term}`).limit(8)
        : Promise.resolve({ data: [] }),
      want('company')
        ? sb.from('crm_companies').select('id, name, trade_name, cedula_juridica').eq('tenant_id', tenantId)
            .or(`name.ilike.${term},trade_name.ilike.${term},cedula_juridica.ilike.${term}`).limit(8)
        : Promise.resolve({ data: [] }),
      want('property')
        ? sb.from('properties').select('id, title, address, canton, provincia').eq('tenant_id', tenantId)
            .or(`title.ilike.${term},address.ilike.${term}`).limit(8)
        : Promise.resolve({ data: [] }),
    ])

    const out: SearchResult[] = []
    for (const c of (contacts.data ?? []) as Record<string, string>[])
      out.push({ type: 'contact', id: c.id, title: [c.name, c.last_name].filter(Boolean).join(' '), subtitle: c.email ?? c.cedula ?? 'Contacto', href: `/admin/contactos?id=${c.id}` })
    for (const co of (companies.data ?? []) as Record<string, string>[])
      out.push({ type: 'company', id: co.id, title: co.trade_name || co.name, subtitle: co.trade_name ? co.name : (co.cedula_juridica ?? 'Empresa'), href: `/admin/empresas?id=${co.id}` })
    for (const p of (props.data ?? []) as Record<string, string>[])
      out.push({ type: 'property', id: p.id, title: p.title || 'Sin título', subtitle: [p.canton, p.provincia].filter(Boolean).join(', ') || p.address || 'Propiedad', href: `/admin/propiedades/${p.id}` })

    setResults(out)
    setSearching(false)
  }, [tenantId])

  function onChange(q: string) {
    setQuery(q); setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => runSearch(q, scope), 300)
  }
  function changeScope(sc: Scope) {
    setScope(sc); setScopeOpen(false)
    if (query.trim().length >= 2) runSearch(query, sc)
  }

  async function openPreview(r: SearchResult) {
    setPreview({ r, data: {} }); setPreviewLoading(true)
    const sb = createClient()
    let data: Record<string, unknown> = {}
    if (r.type === 'contact') {
      const { data: d } = await sb.from('crm_contacts').select('name, last_name, email, phone, phone_country, cedula, cedula_tipo, photo_url, instagram, facebook, linkedin, notes').eq('id', r.id).single()
      data = d ?? {}
    } else if (r.type === 'company') {
      const { data: d } = await sb.from('crm_companies').select('name, trade_name, cedula_juridica').eq('id', r.id).single()
      data = d ?? {}
    } else {
      const { data: d } = await sb.from('properties').select('title, price, currency, status, crm_status, bedrooms, bathrooms, area_m2, address, canton, provincia, images').eq('id', r.id).single()
      data = d ?? {}
    }
    setPreview({ r, data }); setPreviewLoading(false)
  }

  function goFull(href: string) {
    setOpen(false); setPreview(null); setQuery(''); setResults([])
    router.push(href)
  }

  const showDropdown = open && query.length >= 2
  const grouped = ORDER.map(k => ({ kind: k, items: results.filter(r => r.type === k) })).filter(g => g.items.length)

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1, maxWidth: 480, display: 'flex', height: 36, border: '1px solid #e2e5ea', borderRadius: 10, background: '#f9fafb' }}>

      {/* Filtro por tipo */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setScopeOpen(o => !o)}
          style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: 'none', borderRight: '1px solid #e2e5ea', borderRadius: '10px 0 0 10px', background: 'transparent', fontSize: 13, color: '#111', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {SCOPES.find(s => s.key === scope)!.label}
          <span style={{ fontSize: 9, color: '#9ca3af' }}>▼</span>
        </button>
        {scopeOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 401, overflow: 'hidden', minWidth: 150 }}>
            {SCOPES.map((s, i) => (
              <div key={s.key} onClick={() => changeScope(s.key)}
                style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: scope === s.key ? 'var(--color-primary, #111)' : '#111', fontWeight: scope === s.key ? 600 : 400, background: scope === s.key ? '#f4f7ff' : 'transparent', borderTop: i > 0 ? '1px solid #f4f5f7' : 'none' }}
                onMouseEnter={e => { if (scope !== s.key) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb' }}
                onMouseLeave={e => { if (scope !== s.key) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                {s.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ position: 'relative', flex: 1 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa', pointerEvents: 'none' }}>🔍</span>
        <input ref={inputRef} value={query} onChange={e => onChange(e.target.value)} onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Buscar contactos, empresas, propiedades…"
          style={{ width: '100%', height: '100%', paddingLeft: 36, paddingRight: 60, border: 'none', borderRadius: '0 10px 10px 0', fontSize: 13, color: '#111', background: 'transparent', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#bbb', background: '#f0f0f0', borderRadius: 5, padding: '2px 5px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>⌘K</span>

        {/* Resultados agrupados */}
        {showDropdown && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 400, overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
            {searching ? (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#aaa' }}>Buscando…</div>
            ) : grouped.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#aaa' }}>Sin resultados para &ldquo;{query}&rdquo;</div>
            ) : grouped.map(g => (
              <div key={g.kind}>
                <div style={{ padding: '9px 16px 5px', fontSize: 11, fontWeight: 700, color: '#9aa1ad', textTransform: 'uppercase', letterSpacing: '.05em', background: '#fafbfc', borderTop: '1px solid #f4f5f7' }}>
                  {ICONS[g.kind]} {SECTION[g.kind]}
                </div>
                {g.items.map(r => (
                  <div key={r.id} onClick={() => openPreview(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: preview?.r.id === r.id ? '#f4f7ff' : 'transparent' }}
                    onMouseEnter={e => { if (preview?.r.id !== r.id) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { if (preview?.r.id !== r.id) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#c5cad3', flexShrink: 0 }}>›</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de resumen — tarjeta flotante a la derecha del buscador */}
      {preview && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 'calc(100% + 8px)', width: 380, maxHeight: '78vh', background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.14)', zIndex: 402, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PreviewPanel preview={preview} loading={previewLoading} onClose={() => setPreview(null)} onOpen={() => goFull(preview.r.href)} />
        </div>
      )}
    </div>
  )
}

// ── Panel de resumen ─────────────────────────────────────────────
function PreviewPanel({ preview, loading, onClose, onOpen }: {
  preview: { r: SearchResult; data: Record<string, unknown> }; loading: boolean; onClose: () => void; onOpen: () => void
}) {
  const { r, data } = preview
  const s = (k: string) => (data[k] == null || data[k] === '' ? null : String(data[k]))
  const n = (k: string) => (data[k] == null ? null : Number(data[k]))

  const rows: [string, string | null][] =
    r.type === 'contact' ? [
      ['Email', s('email')],
      ['Teléfono', s('phone') ? `${s('phone_country') ? '+' + s('phone_country') + ' ' : ''}${s('phone')}` : null],
      ['Cédula', s('cedula') ? `${s('cedula')}${s('cedula_tipo') ? ` (${s('cedula_tipo')})` : ''}` : null],
      ['Instagram', s('instagram')],
      ['Facebook', s('facebook')],
      ['LinkedIn', s('linkedin')],
      ['Notas', s('notes')],
    ] : r.type === 'company' ? [
      ['Nombre comercial', s('trade_name')],
      ['Razón social', s('name')],
      ['Cédula jurídica', s('cedula_juridica')],
    ] : [
      ['Precio', n('price') != null ? `${data.currency === 'CRC' ? '₡' : '$'}${Number(data.price).toLocaleString()}` : null],
      ['Estado', s('crm_status') || s('status')],
      ['Ubicación', [s('canton'), s('provincia')].filter(Boolean).join(', ') || s('address')],
      ['Habitaciones', n('bedrooms') != null ? String(n('bedrooms')) : null],
      ['Baños', n('bathrooms') != null ? String(n('bathrooms')) : null],
      ['Área', n('area_m2') != null ? `${n('area_m2')} m²` : null],
    ]

  const photo = r.type === 'contact' ? s('photo_url') : null
  const heroImg = r.type === 'property' ? (Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null) : null

  return (
    <>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0f1f3', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{ICONS[r.type]}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1.25 }}>{r.title}</div>
          <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 2 }}>{SECTION[r.type]}</div>
        </div>
        <button onClick={onClose} title="Cerrar" style={{ background: '#f2f3f5', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#666', fontSize: 15, flexShrink: 0, lineHeight: 1 }}>×</button>
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: '#aaa' }}>Cargando…</div>
        ) : (
          <>
            {heroImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImg} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 10, marginBottom: 16, display: 'block' }} />
            )}
            {rows.filter(([, v]) => v).length === 0 ? (
              <div style={{ fontSize: 13, color: '#aaa' }}>Sin información adicional.</div>
            ) : rows.filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa1ad', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#111', wordBreak: 'break-word' }}>{value}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 18px', borderTop: '1px solid #f0f1f3' }}>
        <button onClick={onOpen}
          style={{ width: '100%', background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Abrir ficha completa →
        </button>
      </div>
    </>
  )
}
