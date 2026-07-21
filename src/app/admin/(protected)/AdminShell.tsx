'use client'

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import DateTimeWeather from '@/components/admin/DateTimeWeather'
import GlobalSearch from '@/components/admin/GlobalSearch'
import { themeCssVars } from '@/lib/theme'

// ── Íconos de línea (mismo estilo SVG que el dashboard) ────────
const ic = (children: ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
    {children}
  </svg>
)
const ICON = {
  dashboard: ic(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>),
  crm:       ic(<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />),
  home:      ic(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>),
  user:      ic(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  building:  ic(<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4M10 10h4M10 14h4M10 18h4" /></>),
  inbox:     ic(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  admin:     ic(<><line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" /><line x1="21" x2="12" y1="12" y2="12" /><line x1="8" x2="3" y1="12" y2="12" /><line x1="21" x2="16" y1="20" y2="20" /><line x1="12" x2="3" y1="20" y2="20" /><line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="16" x2="16" y1="18" y2="22" /></>),
  wrench:    ic(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  pen:       ic(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  card:      ic(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></>),
  tag:       ic(<><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>),
  trending:  ic(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>),
  calendar:  ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>),
  camera:    ic(<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>),
  globe:     ic(<><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></>),
  logout:    ic(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>),
} as const

// ── Nav structure ─────────────────────────────────────────────
// El sidebar solo muestra la operación diaria. Todo lo administrativo
// (Sitio web, Configuración CRM, Métricas, Reclutamiento, gestión de oficina)
// vive en el hub /admin/administracion.
const NAV_GROUPS = [
  {
    key:   'crm',
    label: 'CRM',
    icon:  ICON.crm,
    items: [
      { href: '/admin/propiedades', icon: ICON.home,     label: 'Propiedades' },
      { href: '/admin/contactos',  icon: ICON.user,     label: 'Contactos'  },
      { href: '/admin/empresas',   icon: ICON.building, label: 'Empresas'   },
      { href: '/admin/leads',      icon: ICON.inbox,    label: 'Leads'      },
    ],
  },
]

// Rutas que pertenecen al hub de Administración (para resaltar el link)
const ADMIN_HUB_ROUTES = [
  '/admin/general', '/admin/mapa', '/admin/visualizacion', '/admin/paginas',
  '/admin/fuentes', '/admin/agentes', '/admin/seo', '/admin/crm-config',
  '/admin/metricas', '/admin/reclutamiento', '/admin/tools/admin',
]

// Catálogo de herramientas — el tenant solo ve las que tiene en tenants.proptools_apps
const PROPTOOLS_CATALOG: Record<string, { icon: ReactNode; label: string; href: string }> = {
  firmas:       { icon: ICON.pen,      label: 'Firmas',       href: '/admin/tools/firmas' },
  tarjetas:     { icon: ICON.card,     label: 'Tarjetas',     href: '/admin/tools/tarjetas' },
  rotulos:      { icon: ICON.tag,      label: 'Rótulos',      href: '/admin/tools/rotulos' },
  valoraciones: { icon: ICON.trending, label: 'Valoraciones', href: '/admin/tools/valoraciones' },
  calendario:   { icon: ICON.calendar, label: 'Calendario',   href: '/admin/tools/calendario' },
  equipos:      { icon: ICON.camera,   label: 'Equipos',      href: '/admin/tools/equipos' },
}

// Rutas de listado que usan el ancho completo de la pantalla
const WIDE_ROUTES = ['/admin/dashboard', '/admin/contactos', '/admin/empresas', '/admin/leads', '/admin/propiedades']

const SIDEBAR_W_OPEN   = 216
const SIDEBAR_W_CLOSED = 72
const TOPBAR_H         = 54

// ── Types ─────────────────────────────────────────────────────
interface Tenant { id: string; name: string; slug: string; logo_url: string | null; theme: Record<string, string>; proptools_apps?: string[] | null }
interface Props   { tenant: Tenant; userEmail: string; role?: 'admin' | 'agent'; children: React.ReactNode }

// ── Component ─────────────────────────────────────────────────
export default function AdminShell({ tenant, userEmail, role = 'admin', children }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const tab      = useSearchParams().get('tab')
  // Ruta actual incluyendo ?tab= (los links de Administración lo usan)
  const currentPath = pathname + (tab ? `?tab=${tab}` : '')
  // Un item está activo si su href (con o sin query) matchea la ruta actual
  const isActive = (href: string) => href.includes('?')
    ? currentPath === href
    : pathname.startsWith(href) && !pathname.startsWith('/admin/tools/admin')

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

  // Grupo de herramientas según las apps activas del tenant.
  const ptApps = (tenant.proptools_apps ?? []).filter(s => PROPTOOLS_CATALOG[s])
  const ptItems = ptApps.map(s => ({ ...PROPTOOLS_CATALOG[s] }))
  const ptGroup = ptItems.length > 0
    ? [{ key: 'proptools', label: 'Herramientas', icon: ICON.wrench, items: ptItems }]
    : []
  const navGroups = [...NAV_GROUPS, ...ptGroup]
  // Administración: link único al hub (solo admin).
  const standalone = role === 'agent' ? [] : [{ href: '/admin/administracion', icon: ICON.admin, label: 'Administración' }]

  // Guard: si un agente escribe una URL admin-only, redirigir al CRM.
  // (Los datos igual están protegidos por RLS; esto es solo UI.)
  useEffect(() => {
    if (role !== 'agent') return
    const allowed = ['/admin/propiedades', '/admin/contactos', '/admin/empresas', '/admin/leads', '/admin/tools/', '/admin/dashboard']
    const ok = allowed.some(p => pathname.startsWith(p)) && !pathname.startsWith('/admin/tools/admin')
    if (!ok) router.replace('/admin/dashboard')
  }, [role, pathname, router])

  // ── Nav group collapse — all closed by default ────────────
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...Object.fromEntries(NAV_GROUPS.map(g => [g.key, true])), proptools: true })
  )
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      const hasActive = group.items.some(item => pathname.startsWith(item.href))
      if (hasActive) setCollapsed(prev => ({ ...prev, [group.key]: false }))
    }
    // El grupo de herramientas no está en NAV_GROUPS (se arma por tenant); /admin/tools/admin
    // se accede desde el hub, no resalta grupo del sidebar.
    if (pathname.startsWith('/admin/tools/') && pathname !== '/admin/tools/admin') {
      setCollapsed(prev => ({ ...prev, proptools: false }))
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
    { icon: ICON.user,     label: 'Nuevo contacto',   href: '/admin/contactos?new=1'  },
    { icon: ICON.building, label: 'Nueva empresa',    href: '/admin/empresas?new=1'   },
    { icon: ICON.home,     label: 'Nueva propiedad',  href: '/admin/propiedades/nueva' },
  ]

  const sidebarW = open ? SIDEBAR_W_OPEN : SIDEBAR_W_CLOSED

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f7', fontFamily: 'system-ui, sans-serif', ...themeCssVars(tenant.theme) }}>

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
          {/* La marca del sidebar es siempre Noduus; el tenant se identifica por
              nombre debajo. Su logo vive en el sitio público y el material de
              impresión, donde manda su marca y no la de la plataforma. */}
          {open ? (
            <div style={{ overflow: 'hidden' }}>
              <img src="/noduus_logo.png" alt="Noduus" style={{ height: 22, width: 'auto', marginBottom: 8, display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{tenant.name}</div>
            </div>
          ) : (
            // El isotipo es apaisado (459×256): se fija el alto y el ancho sale
            // solo, si no queda aplastado. A 24px de alto mide 43, y entra
            // holgado en los 72 del sidebar comprimido.
            <img src="/noduus_icon.png" alt="Noduus" title={tenant.name} style={{ height: 24, width: 'auto', display: 'block' }} />
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0 12px', overflowY: 'auto', overflowX: 'hidden' }}>

          {/* Dashboard — página principal, visible para todos los roles */}
          {(() => {
            const active = pathname.startsWith('/admin/dashboard')
            return (
              <div style={{ marginBottom: 4 }}>
                <a href="/admin/dashboard" style={{ display: 'flex', flexDirection: open ? 'row' : 'column', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: open ? 9 : 2, padding: open ? '8px 20px' : '6px 0', textDecoration: 'none', fontSize: 13, color: active ? '#111' : '#666', background: active ? '#f5f5f7' : 'transparent', fontWeight: active ? 600 : 400, borderLeft: `3px solid ${active ? '#111' : 'transparent'}`, transition: 'background .1s', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#fafafa' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  <span style={{ display: 'flex' }}>{ICON.dashboard}</span>
                  {open
                    ? 'Dashboard'
                    : <span style={{ fontSize: 9, color: active ? '#111' : '#888', fontWeight: active ? 700 : 400, letterSpacing: '.01em', maxWidth: 62, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dashboard</span>}
                </a>
                <div style={{ height: 1, background: '#f0f0f0', margin: open ? '6px 16px 2px' : '6px 10px 2px' }} />
              </div>
            )
          })()}

          {navGroups.map(group => {
            const isOpen    = !collapsed[group.key]
            const hasActive = group.items.some(item => isActive(item.href))
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
                    {group.items.map(item => {
                      const { href, icon, label } = item
                      const external = 'external' in item && item.external
                      const active = !external && isActive(href)
                      return (
                        <a key={href} href={href}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noopener noreferrer' : undefined}
                          style={{ display: 'flex', flexDirection: open ? 'row' : 'column', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: open ? 9 : 2, padding: open ? '8px 20px 8px 28px' : '6px 0', textDecoration: 'none', fontSize: 13, color: active ? '#111' : '#666', background: active ? '#f5f5f7' : 'transparent', fontWeight: active ? 600 : 400, borderLeft: `3px solid ${active ? '#111' : 'transparent'}`, transition: 'background .1s', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#fafafa' }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                        >
                          <span style={{ fontSize: open ? 14 : 16 }}>{icon}</span>
                          {open
                            ? <>{label}{external && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>↗</span>}</>
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

          {standalone.map(({ href, icon, label }) => {
            // Administración resalta también dentro de sus subpáginas del hub
            const active = pathname.startsWith(href) || (href === '/admin/administracion' && ADMIN_HUB_ROUTES.some(r => pathname.startsWith(r)))
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
              <a href="/" target="_blank" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', padding: '2px 0', color: '#888' }}>
                {ICON.globe}
                <span style={{ fontSize: 8, color: '#aaa', whiteSpace: 'nowrap' }}>Sitio</span>
              </a>
              <button onClick={signOut} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', color: '#e53e3e' }}>
                {ICON.logout}
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
        <GlobalSearch tenantId={tenant.id} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Fecha · reloj · clima ─────────────────────── */}
        <div style={{ marginRight: 16 }}><DateTimeWeather /></div>

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
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.18)',
              transition: 'background .15s, transform .15s, box-shadow .15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#222'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.28)' }}
            onMouseLeave={e => { if (!plusOpen) (e.currentTarget as HTMLButtonElement).style.background = '#111'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.18)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: 'block' }}>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
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
        // Mismo fondo en todas las páginas: acento gris muy claro arriba a
        // la derecha + degradado blanco→gris hacia abajo (antes solo vivía
        // en el dashboard, con un truco de márgenes negativos).
        background: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(17,17,17,.045), transparent 70%), linear-gradient(180deg, #ffffff 0px, #ffffff 490px, #e4e7ec 100%)',
      }}>
        <div style={{ maxWidth: WIDE_ROUTES.some(r => pathname === r) || pathname.startsWith('/admin/tools/') ? 'none' : 1100 }}>
          {children}
        </div>
      </main>

    </div>
  )
}
