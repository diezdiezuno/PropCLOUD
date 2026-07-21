'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAV = [
  { href: '/superadmin/tenants',   icon: '🏢', label: 'Tenants'    },
  { href: '/superadmin/templates', icon: '🎨', label: 'Plantillas' },
]

interface Props { userEmail: string; children: React.ReactNode }

export default function SuperAdminShell({ userEmail, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/superadmin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f0f', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 200, background: '#141414', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 300 }}>
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid #222' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>Noduus</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Super Admin</div>
        </div>
        <nav style={{ flex: 1, padding: '10px 0' }}>
          {NAV.map(({ href, icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <a key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', textDecoration: 'none', fontSize: 13, color: active ? '#fff' : '#666', background: active ? '#1f1f1f' : 'transparent', fontWeight: active ? 600 : 400, borderLeft: `3px solid ${active ? '#fff' : 'transparent'}` }}>
                <span>{icon}</span>{label}
              </a>
            )
          })}
        </nav>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #222' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          <a href="/admin" style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, textDecoration: 'none' }}>← Panel tenant</a>
          <button onClick={signOut} style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Cerrar sesión</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 200, flex: 1, padding: '36px 44px', color: '#fff' }}>
        <div style={{ maxWidth: 900 }}>{children}</div>
      </main>
    </div>
  )
}
