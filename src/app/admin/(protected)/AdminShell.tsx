'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// ── Nav structure ─────────────────────────────────────────────
const NAV_GROUPS = [
  {
    key:   'sitio',
    label: 'Sitio web',
    icon:  '🌐',
    items: [
      { href: '/admin/general',     icon: '⚙️', label: 'General'     },
      { href: '/admin/mapa',        icon: '🗺️', label: 'Mapa'        },
      { href: '/admin/propiedades', icon: '🏠', label: 'Propiedades'  },
      { href: '/admin/paginas',     icon: '📄', label: 'Páginas'      },
      { href: '/admin/fuentes',     icon: '🔗', label: 'Fuentes'      },
      { href: '/admin/agentes',     icon: '👥', label: 'Agentes'      },
      { href: '/admin/seo',         icon: '🔍', label: 'SEO'          },
    ],
  },
  {
    key:   'crm',
    label: 'CRM',
    icon:  '🗂️',
    items: [
      { href: '/admin/inventario', icon: '🏘️', label: 'Inventario' },
      { href: '/admin/clientes',   icon: '👤', label: 'Clientes'   },
      { href: '/admin/empresas',   icon: '🏢', label: 'Empresas'   },
      { href: '/admin/leads',      icon: '📬', label: 'Leads'      },
    ],
  },
]

const NAV_STANDALONE = [
  { href: '/admin/metricas',      icon: '📊', label: 'Métricas'      },
  { href: '/admin/reclutamiento', icon: '🤝', label: 'Reclutamiento' },
]

const SIDEBAR_W_OPEN   = 216
const SIDEBAR_W_CLOSED = 72
const TOPBAR_H         = 54

// ── Search result type ────────────────────────────────────────
interface SearchResult {
  type:     'contact' | 'company' | 'property'
  id:       string
  title:    string
  subtitle: string
  href:     string
}

// ── Types ─────────────────────────────────────────────────────
interface Tenant { id: string; name: string; slug: string; logo_url: string | null; theme: Record<string, string> }
interface Props   { tenant: Tenant; userEmail: string; children: React.ReactNode }

// ── Component ─────────────────────────────────────────────────
export default function AdminShell({ tenant, userEmail, children }: Props) {
  const pathname = usePathname()
  const router   = useRouter()

  // ── Sidebar open/closed ────────────────────────────────────
  const [open, setOpen] = useState(true)
  useEffect(() => {
    const stored = localStorage.getItem('sidebar_open')
    if (stored !== null) setOpen(stored === '1')
  }, [])
  function toggleSidebar() {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem('sidebar_open', next ? '1' : '0')
      return next
    })
  }

  // ── Nav group collapse — all closed by default ────────────
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_GROUPS.map(g => [g.key, true]))
  )
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      const hasActive = group.items.some(item => pathname.startsWith(item.href))
      if (hasActive) setCollapsed(prev => ({ ...prev, [group.key]: false }))
    }
  }, [pathname])
  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Sign out ───────────────────────────────────────────────
  async function signOut() {
    await createClient().auth.signOut()
    router.push('/admin/login')
  }

  // ── Global search ──────────────────────────────────────────
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<SearchResult[]>([])
  const [searching,    setSearching]    = useState(false)
  const [searchOpen,   setSearchOpen]   = useState(false)
  const searchRef      = useRef<HTMLDivElement>(null)
  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close search on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    const sb  = createClient()
    const tid = tenant.id
    const term = `%${q.trim()}%`

    const [{ data: contacts }, { data: companies }, { data: props }] = await Promise.all([
      sb.from('crm_contacts')
        .select('id, name, last_name, email, cedula')
        .eq('tenant_id', tid)
        .or(`name.ilike.${term},last_name.ilike.${term},email.ilike.${term},cedula.ilike.${term}`)
        .limit(4),
      sb.from('crm_companies')
        .select('id, name, trade_name, cedula_juridica')
        .eq('tenant_id', tid)
        .or(`name.ilike.${term},trade_name.ilike.${term},cedula_juridica.ilike.${term}`)
        .limit(4),
      sb.from('properties')
        .select('id, title, address, canton, provincia')
        .eq('tenant_id', tid)
        .or(`title.ilike.${term},address.ilike.${term}`)
        .limit(4),
    ])

    const out: SearchResult[] = []
    for (const c of contacts ?? []) {
      out.push({
        type:     'contact',
        id:       c.id,
        title:    [c.name, c.last_name].filter(Boolean).join(' '),
        subtitle: c.email ?? c.cedula ?? 'Cliente',
        href:     `/admin/clientes?id=${c.id}`,
      })
    }
    for (const co of companies ?? []) {
      out.push({
        type:     'company',
        id:       co.id,
        title:    co.trade_name || co.name,
        subtitle: co.trade_name ? co.name : (co.cedula_juridica ?? 'Empresa'),
        href:     `/admin/empresas?id=${co.id}`,
      })
    }
    for (const p of props ?? []) {
      out.push({
        type:     'property',
        id:       p.id,
        title:    p.title || 'Sin título',
        subtitle: [p.canton, p.provincia].filter(Boolean).join(', ') || p.address || 'Propiedad',
        href:     `/admin/inventario/${p.id}`,
      })
    }
    setResults(out)
    setSearching(false)
  }, [tenant.id])

  function handleSearchChange(q: string) {
    setQuery(q)
    setSearchOpen(true)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(q), 300)
  }

  function goToResult(href: string) {
    setSearchOpen(false)
    setQuery('')
    setResults([])
    router.push(href)
  }

  // ── Quick add "+" dropdown ─────────────────────────────────
  const [plusOpen,  setPlusOpen]  = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const QUICK_ADD = [
    { icon: '👤', label: 'Nuevo cliente',    href: '/admin/clientes?new=1'   },
    { icon: '🏢', label: 'Nueva empresa',    href: '/admin/empresas?new=1'   },
    { icon: '🏘️', label: 'Nueva propiedad',  href: '/admin/inventario?new=1' },
  ]

  const RESULT_ICONS: Record<string, string> = { contact: '👤', company: '🏢', property: '🏘️' }

  const sidebarW = open ? SIDEBAR_W_OPEN : SIDEBAR_W_CLOSED

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f7', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarW,
        background: '#fff',
        borderRight: '1px solid #ebebeb',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, bottom: 0, left: 0,
        zIndex: 300,
        overflow: 'hidden',
        transition: 'width .2s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Brand */}
        <div style={{ padding: open ? '22px 20px 18px' : '18px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', transition: 'padding .2s', overflow: 'hidden', minHeight: 72 }}>
          {open ? (
            <div style={{ overflow: 'hidden' }}>
              {tenant.logo_url && (
                <img src={tenant.logo_url} alt="" style={{ height: 28, objectFit: 'contain', marginBottom: 8, display: 'block' }} />
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{tenant.name}</div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, whiteSpace: 'nowrap' }}>Panel de administración</div>
            </div>
          ) : (
            <div title={tenant.name} style={{ fontSize: 20 }}>
              {tenant.logo_url
                ? <img src={tenant.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain', display: 'block' }} />
                : '🏠'}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0 12px', overflowY: 'auto', overflowX: 'hidden' }}>

          {NAV_GROUPS.map(group => {
            const isOpen    = !collapsed[group.key]
            const hasActive = group.items.some(item => pathname.startsWith(item.href))
            return (
              <div key={group.key} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => toggle(group.key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center', padding: open ? '7px 20px 7px 16px' : '6px 0 4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {open ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 14 }}>{group.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: hasActive ? '#111' : '#999', whiteSpace: 'nowrap' }}>
                          {group.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 9, color: '#bbb', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s', display: 'inline-block' }}>▼</span>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 15 }}>{group.icon}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: hasActive ? '#111' : '#aaa', whiteSpace: 'nowrap' }}>{group.label}</span>
                      <span style={{ fontSize: 7, color: '#ccc', lineHeight: 1, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s', display: 'inline-block' }}>▾</span>
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div>
                    {group.items.map(({ href, icon, label }) => {
                      const active = pathname.startsWith(href)
                      return (
                        <a key={href} href={href} style={{ display: 'flex', flexDirection: open ? 'row' : 'column', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: open ? 9 : 2, padding: open ? '8px 20px 8px 28px' : '6px 0', textDecoration: 'none', fontSize: 13, color: active ? '#111' : '#666', background: active ? '#f5f5f7' : 'transparent', fontWeight: active ? 600 : 400, borderLeft: `3px solid ${active ? '#111' : 'transparent'}`, transition: 'background .1s', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#fafafa' }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                        >
                          <span style={{ fontSize: open ? 14 : 16 }}>{icon}</span>
                          {open
                            ? label
                            : <span style={{ fontSize: 9, color: active ? '#111' : '#888', fontWeight: active ? 700 : 400, letterSpacing: '.01em', maxWidth: 62, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                          }
                        </a>
                      )
                    })}
                  </div>
                )}
                <div style={{ height: 1, background: '#f0f0f0', margin: open ? '6px 16px 2px' : '6px 10px 2px' }} />
              </div>
            )
          })}

          {NAV_STANDALONE.map(({ href, icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <div key={href}>
                <a href={href} style={{ display: 'flex', flexDirection: open ? 'row' : 'column', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: open ? 9 : 2, padding: open ? '8px 20px' : '6px 0', textDecoration: 'none', fontSize: 13, color: active ? '#111' : '#666', background: active ? '#f5f5f7' : 'transparent', fontWeight: active ? 600 : 400, borderLeft: `3px solid ${active ? '#111' : 'transparent'}`, transition: 'background .1s', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#fafafa' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: open ? 14 : 16 }}>{icon}</span>
                  {open
                    ? label
                    : <span style={{ fontSize: 9, color: active ? '#111' : '#888', fontWeight: active ? 700 : 400, letterSpacing: '.01em', maxWidth: 62, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                  }
                </a>
                <div style={{ height: 1, background: '#f0f0f0', margin: open ? '6px 16px 2px' : '6px 10px 2px' }} />
              </div>
            )
          })}

        </nav>

        {/* Footer */}
        <div style={{ padding: open ? '14px 20px' : '12px 0', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', alignItems: open ? 'flex-start' : 'center', gap: 6 }}>
          {open ? (
            <>
              <div style={{ fontSize: 11, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{userEmail}</div>
              <a href="/" target="_blank" style={{ fontSize: 12, color: '#888', display: 'block', textDecoration: 'none' }}>Ver sitio →</a>
              <button onClick={signOut} style={{ fontSize: 12, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <a href="/" target="_blank" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', padding: '2px 0' }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>🌍</span>
                <span style={{ fontSize: 8, color: '#aaa', whiteSpace: 'nowrap' }}>Sitio</span>
              </a>
              <button onClick={signOut} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>🚪</span>
                <span style={{ fontSize: 8, color: '#e53e3e', whiteSpace: 'nowrap' }}>Salir</span>
              </button>
            </>
          )}
        </div>

      </aside>

      {/* ── Sidebar toggle — fuera del aside para no ser recortado ── */}
      <button
        onClick={toggleSidebar}
        title={open ? 'Colapsar menú' : 'Expandir menú'}
        style={{
          position: 'fixed',
          top: TOPBAR_H + 20,
          left: sidebarW - 12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#fff',
          border: '1px solid #e2e5ea',
          boxShadow: '0 2px 8px rgba(0,0,0,.12)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#555',
          zIndex: 400,
          transition: 'left .2s cubic-bezier(.4,0,.2,1), box-shadow .15s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 3px 12px rgba(0,0,0,.22)'; (e.currentTarget as HTMLButtonElement).style.color = '#111' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
      >
        {open ? '‹' : '›'}
      </button>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        top: 0, left: sidebarW, right: 0,
        height: TOPBAR_H,
        background: '#fff',
        borderBottom: '1px solid #ebebeb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 12,
        zIndex: 200,
        transition: 'left .2s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* ── Search ──────────────────────────────────── */}
        <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa', pointerEvents: 'none' }}>🔍</span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => query.length >= 2 && setSearchOpen(true)}
              placeholder="Buscar clientes, empresas, propiedades…"
              style={{
                width: '100%', height: 36,
                paddingLeft: 36, paddingRight: 60,
                border: '1px solid #e2e5ea',
                borderRadius: 10,
                fontSize: 13, color: '#111',
                background: '#f9fafb',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#c5cad3' }}
              onMouseLeave={e => { if (document.activeElement !== e.currentTarget) (e.currentTarget as HTMLInputElement).style.borderColor = '#e2e5ea' }}
              onFocusCapture={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#111'; (e.currentTarget as HTMLInputElement).style.background = '#fff' }}
              onBlurCapture={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#e2e5ea'; (e.currentTarget as HTMLInputElement).style.background = '#f9fafb' }}
            />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#bbb', background: '#f0f0f0', borderRadius: 5, padding: '2px 5px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>⌘K</span>
          </div>

          {/* Results dropdown */}
          {searchOpen && query.length >= 2 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 400, overflow: 'hidden' }}>
              {searching ? (
                <div style={{ padding: '14px 16px', fontSize: 13, color: '#aaa' }}>Buscando…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: '14px 16px', fontSize: 13, color: '#aaa' }}>Sin resultados para &ldquo;{query}&rdquo;</div>
              ) : (
                <>
                  {results.map((r, i) => (
                    <div
                      key={r.id}
                      onClick={() => goToResult(r.href)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f4f5f7' : 'none', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{RESULT_ICONS[r.type]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
                      </div>
                      <span style={{ fontSize: 11, color: '#c5cad3', flexShrink: 0 }}>→</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Quick add "+" ────────────────────────────── */}
        <div ref={plusRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setPlusOpen(p => !p)}
            title="Crear nuevo"
            style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: plusOpen ? '#222' : '#111',
              color: '#fff',
              border: 'none',
              fontSize: 24, lineHeight: 1, fontWeight: 300,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.18)',
              transition: 'background .15s, transform .15s, box-shadow .15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#222'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.28)' }}
            onMouseLeave={e => { if (!plusOpen) (e.currentTarget as HTMLButtonElement).style.background = '#111'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.18)' }}
          >
            +
          </button>

          {plusOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 400, overflow: 'hidden', minWidth: 180 }}>
              {QUICK_ADD.map(({ icon, label, href }, i) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setPlusOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', textDecoration: 'none', color: '#0d0f12', fontSize: 13, fontWeight: 500, borderTop: i > 0 ? '1px solid #f4f5f7' : 'none', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#f9fafb'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                >
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <main style={{
        marginLeft: sidebarW,
        marginTop: TOPBAR_H,
        flex: 1,
        padding: '36px 44px',
        minHeight: `calc(100vh - ${TOPBAR_H}px)`,
        transition: 'margin-left .2s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ maxWidth: 1100 }}>
          {children}
        </div>
      </main>

    </div>
  )
}
