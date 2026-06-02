'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAV = [
  { href: '/admin/general',      icon: '⚙️',  label: 'General' },
  { href: '/admin/mapa',         icon: '🗺️',  label: 'Mapa' },
  { href: '/admin/inventario',   icon: '🏘️',  label: 'Inventario' },
  { href: '/admin/propiedades',  icon: '🏠',  label: 'Propiedades' },
  { href: '/admin/paginas',      icon: '📄',  label: 'Páginas' },
  { href: '/admin/fuentes',        icon: '🔗',  label: 'Fuentes' },
  { href: '/admin/agentes',         icon: '👥',  label: 'Agentes' },
  { href: '/admin/leads',          icon: '📬',  label: 'Leads' },
  { href: '/admin/metricas',       icon: '📊',  label: 'Métricas' },
  { href: '/admin/reclutamiento',  icon: '🤝',  label: 'Reclutamiento' },
  { href: '/admin/seo',            icon: '🔍',  label: 'SEO' },
]

interface Tenant { id: string; name: string; slug: string; logo_url: string | null; theme: Record<string, string> }
interface Props { tenant: Tenant; userEmail: string; children: React.ReactNode }

export default function AdminShell({ tenant, userEmail, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/admin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f7', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: 216, background: '#fff', borderRight: '1px solid #ebebeb',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 300,
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid #f0f0f0' }}>
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt="" style={{ height: 28, objectFit: 'contain', marginBottom: 8, display: 'block' }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{tenant.name}</div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>Panel de administración</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {NAV.map(({ href, icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <a key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 20px', textDecoration: 'none', fontSize: 13,
                color: active ? '#111' : '#666',
                background: active ? '#f5f5f7' : 'transparent',
                fontWeight: active ? 600 : 400,
                borderLeft: `3px solid ${active ? '#111' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 15 }}>{icon}</span>
                {label}
              </a>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail}
          </div>
          <a href="/" target="_blank" style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6, textDecoration: 'none' }}>
            Ver sitio →
          </a>
          <button onClick={signOut} style={{
            fontSize: 12, color: '#e53e3e', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main style={{ marginLeft: 216, flex: 1, padding: '36px 44px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
