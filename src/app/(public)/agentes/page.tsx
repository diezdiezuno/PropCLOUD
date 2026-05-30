import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agentes',
  description: 'Conocé al equipo de asesores inmobiliarios.',
  alternates: { canonical: '/agentes' },
}

interface Agent {
  id: string
  name: string
  position: string | null
  email: string | null
  phone: string | null
  photo_url: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function AgentesPage() {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  if (!tenant) notFound()

  const config = await getTenantConfig(tenant.id).catch(() => null)
  const pageCfg = config?.pages_config?.find(p => p.slug === 'agentes')
  if (pageCfg && !pageCfg.visible) notFound()

  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, position, email, phone, photo_url')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')

  const list = (agents ?? []) as Agent[]

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', fontFamily: 'var(--font-body,system-ui,sans-serif)' }}>

      {/* Hero */}
      <section style={{
        padding: 'clamp(36px,4vw,56px) clamp(24px,3vw,48px) clamp(44px,5vw,68px)',
        maxWidth: 1440, margin: '0 auto',
      }}>
        <div style={{ maxWidth: 680 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading,serif)',
            fontSize: 'clamp(48px,6.5vw,80px)',
            fontWeight: 900, lineHeight: .93,
            letterSpacing: '-.03em', marginBottom: 24, marginTop: 0,
          }}>
            Nuestro{' '}
            <span style={{
              background: 'linear-gradient(90deg,var(--primary,#6b2fa0),#D44E2A,#E8920A)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>equipo.</span>
          </h1>
          <p style={{
            fontSize: 'clamp(15px,1.6vw,18px)', fontWeight: 300,
            color: '#888480', lineHeight: 1.65, margin: 0,
          }}>
            Profesionales especializados en el mercado inmobiliario del Gran Área Metropolitana.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section style={{
        padding: '0 clamp(24px,3vw,48px) clamp(64px,6vw,88px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        {list.length === 0 ? (
          <div style={{ paddingTop: 60, textAlign: 'center', color: '#bbb', fontSize: 15 }}>
            Próximamente.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 2, background: '#e8e4df',
            border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
            marginTop: 'clamp(36px,4vw,52px)',
          }}>
            {list.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div style={{ background: '#fff', padding: 'clamp(24px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Photo */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: '#f0f0f0', overflow: 'hidden',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>
        {agent.photo_url
          ? <img src={agent.photo_url} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : '👤'
        }
      </div>

      {/* Info */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>{agent.name}</div>
        {agent.position && (
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 500,
            background: 'rgba(107,63,160,.08)', color: 'var(--primary,#6b2fa0)',
            border: '1px solid rgba(107,63,160,.15)',
            borderRadius: 100, padding: '3px 10px',
          }}>
            {agent.position}
          </div>
        )}
      </div>

      {/* Contact */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
        {agent.phone && (
          <a href={`https://wa.me/${agent.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>💬</span> {agent.phone}
          </a>
        )}
        {agent.email && (
          <a href={`mailto:${agent.email}`}
            style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 14 }}>✉️</span> {agent.email}
          </a>
        )}
      </div>
    </div>
  )
}
