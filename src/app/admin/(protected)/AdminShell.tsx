'use client'

import { useState, useEffect } from 'react'
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

// ── Types ─────────────────────────────────────────────────────
interface Tenant { id: string; name: string; slug: string; logo_url: string | null; theme: Record<string, string> }
interface Props   { tenant: Tenant; userEmail: string; children: React.ReactNode }

// ── Component ─────────────────────────────────────────────────
export default function AdminShell({ tenant, userEmail, children }: Props) {
  const pathname = usePathname()
  const router   = useRouter()

  // Sidebar open/closed — persisted in localStorage
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

  // Collapsed state for nav groups — keys match NAV_GROUPS[].key. true = collapsed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Auto-expand the group that contains the active route
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      const hasActive = group.items.some(item => pathname.startsWith(item.href))
      if (hasActive) {
        setCollapsed(prev => ({ ...prev, [group.key]: false }))
      }
    }
  }, [pathname])

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/admin/login')
  }

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

          {/* ── Grouped sections ───────────────────────── */}
          {NAV_GROUPS.map(group => {
            const isOpen    = !collapsed[group.key]
            const hasActive = group.items.some(item => pathname.startsWith(item.href))

            return (
              <div key={group.key} style={{ marginBottom: 4 }}>

                {/* Group header */}
                <button
                  onClick={() => open ? toggle(group.key) : undefined}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: open ? 'space-between' : 'center',
                    padding: open ? '7px 20px 7px 16px' : '6px 0 4px',
                    background: 'none', border: 'none', cursor: open ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  {open ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 14 }}>{group.icon}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: '.05em',
                          textTransform: 'uppercase',
                          color: hasActive ? '#111' : '#999',
                          whiteSpace: 'nowrap',
                        }}>
                          {group.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 9, color: '#bbb',
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform .15s',
                        display: 'inline-block',
                      }}>
                        ▼
                      </span>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 15 }}>{group.icon}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: hasActive ? '#111' : '#aaa', whiteSpace: 'nowrap' }}>
                        {group.label}
                      </span>
                    </div>
                  )}
                </button>

                {/* Group items — always show when sidebar is collapsed (icon only) */}
                {(open ? isOpen : true) && (
                  <div>
                    {group.items.map(({ href, icon, label }) => {
                      const active = pathname.startsWith(href)
                      return (
                        <a
                          key={href}
                          href={href}
                          style={{
                            display: 'flex',
                            flexDirection: open ? 'row' : 'column',
                            alignItems: 'center',
                            justifyContent: open ? 'flex-start' : 'center',
                            gap: open ? 9 : 2,
                            padding: open ? '8px 20px 8px 28px' : '6px 0',
                            textDecoration: 'none',
                            fontSize: 13,
                            color: active ? '#111' : '#666',
                            background: active ? '#f5f5f7' : 'transparent',
                            fontWeight: active ? 600 : 400,
                            borderLeft: `3px solid ${active ? '#111' : 'transparent'}`,
                            transition: 'background .1s',
                            whiteSpace: 'nowrap',
                          }}
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
              </div>
            )
          })}

          {/* ── Divider ─────────────────────────────────── */}
          <div style={{ height: 1, background: '#f0f0f0', margin: open ? '8px 16px' : '8px 12px' }} />

          {/* ── Standalone items ────────────────────────── */}
          {NAV_STANDALONE.map(({ href, icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <a
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  flexDirection: open ? 'row' : 'column',
                  alignItems: 'center',
                  justifyContent: open ? 'flex-start' : 'center',
                  gap: open ? 9 : 2,
                  padding: open ? '8px 20px' : '6px 0',
                  textDecoration: 'none',
                  fontSize: 13,
                  color: active ? '#111' : '#666',
                  background: active ? '#f5f5f7' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  borderLeft: `3px solid ${active ? '#111' : 'transparent'}`,
                  transition: 'background .1s',
                  whiteSpace: 'nowrap',
                }}
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

        </nav>

        {/* Footer */}
        <div style={{ padding: open ? '14px 20px' : '12px 0', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', alignItems: open ? 'flex-start' : 'center', gap: 6 }}>
          {open ? (
            <>
              <div style={{ fontSize: 11, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {userEmail}
              </div>
              <a href="/" target="_blank" style={{ fontSize: 12, color: '#888', display: 'block', textDecoration: 'none' }}>
                Ver sitio →
              </a>
              <button onClick={signOut} style={{ fontSize: 12, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                Cerrar sesión
              </button>
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

        {/* ── Toggle button ────────────────────────────── */}
        <button
          onClick={toggleSidebar}
          title={open ? 'Colapsar sidebar' : 'Expandir sidebar'}
          style={{
            position: 'absolute',
            bottom: open ? 94 : 90,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            border: '1px solid #e2e5ea',
            boxShadow: '0 2px 6px rgba(0,0,0,.10)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: '#666',
            zIndex: 10,
            transition: 'box-shadow .15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 3px 10px rgba(0,0,0,.18)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,.10)'}
        >
          {open ? '‹' : '›'}
        </button>

      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main style={{
        marginLeft: sidebarW,
        flex: 1,
        padding: '36px 44px',
        minHeight: '100vh',
        transition: 'margin-left .2s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ maxWidth: 1100 }}>
          {children}
        </div>
      </main>

      {/* ── Global "+" button ───────────────────────────────────── */}
      <a
        href="/admin/clientes?new=1"
        title="Nuevo cliente"
        style={{
          position: 'fixed', bottom: 28, right: 28,
          width: 48, height: 48, borderRadius: '50%',
          background: '#111', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          zIndex: 200, lineHeight: 1,
          transition: 'transform .15s, box-shadow .15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.08)'
          ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 20px rgba(0,0,0,.32)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.25)'
        }}
      >
        +
      </a>
    </div>
  )
}
