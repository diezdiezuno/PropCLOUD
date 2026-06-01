import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import AgentGrid from './AgentGrid'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agentes',
  description: 'Conocé al equipo de asesores inmobiliarios.',
  alternates: { canonical: '/agentes' },
}

const db = createClient(
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

  // Fetch agents — try with social columns, fallback if not migrated yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let agents: any[] = []
  try {
    const { data, error } = await db
      .from('agents')
      .select('id,name,position,email,phone,photo_url,instagram,facebook,linkedin,tiktok,twitter,youtube,threads')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')

    if (error) {
      // Fallback without social columns
      const { data: base } = await db
        .from('agents')
        .select('id,name,position,email,phone,photo_url')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name')
      agents = base ?? []
    } else {
      agents = data ?? []
    }
  } catch {
    agents = []
  }

  // Sort by position hierarchy
  const POSITION_ORDER: Record<string, number> = {
    'Broker': 0,
    'Team Leader': 1,
    'Asesor Inmobiliario': 2,
    'Administrativo': 3,
    'Asistente': 4,
  }
  agents.sort((a, b) => {
    const aOrder = POSITION_ORDER[a.position ?? ''] ?? 99
    const bOrder = POSITION_ORDER[b.position ?? ''] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

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

      {/* Grid — client component handles hover interactions */}
      <section style={{
        padding: '0 clamp(24px,3vw,48px) clamp(64px,6vw,88px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <AgentGrid agents={agents} />
      </section>
    </div>
  )
}
