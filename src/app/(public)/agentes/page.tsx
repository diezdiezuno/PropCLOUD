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
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tiktok: string | null
  twitter: string | null
  youtube: string | null
  threads: string | null
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

  const { data } = await db
    .from('agents')
    .select('id,name,position,email,phone,photo_url,instagram,facebook,linkedin,tiktok,twitter,youtube,threads')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')

  const agents = (data ?? []) as Agent[]

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
        {agents.length === 0 ? (
          <div style={{ paddingTop: 60, textAlign: 'center', color: '#bbb', fontSize: 15 }}>Próximamente.</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 2, background: '#e8e4df',
            border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
            marginTop: 'clamp(36px,4vw,52px)',
          }}>
            {agents.map(a => <AgentCard key={a.id} agent={a} />)}
          </div>
        )}
      </section>
    </div>
  )
}

/* ── SVG icons ───────────────────────────────────────────────── */
const ICONS: Record<string, { label: string; color: string; svg: React.ReactNode }> = {
  instagram: { label: 'Instagram', color: '#E4405F', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/></svg> },
  facebook:  { label: 'Facebook',  color: '#1877F2', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  tiktok:    { label: 'TikTok',    color: '#010101', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.28 8.28 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z"/></svg> },
  twitter:   { label: 'X',         color: '#000000', svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg> },
  youtube:   { label: 'YouTube',   color: '#FF0000', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  threads:   { label: 'Threads',   color: '#000000', svg: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.196 9.49c.456-.73 1.33-2.658 4.795-2.693h.03c3.47 0 5.343 2.055 5.728 5.317a9.335 9.335 0 0 1 1.376.802c1.359.97 2.157 2.278 2.48 3.987.45 2.42-.516 5.007-2.516 6.937C17.347 23.218 15.065 24 12.186 24zm.25-9.646c-.105 0-.211.003-.317.009-1.205.07-2.087.42-2.557.838-.383.33-.55.737-.524 1.24.077 1.399 1.426 1.782 2.714 1.712 1.266-.069 2.078-.567 2.411-1.483.14-.39.213-.866.22-1.415a13.912 13.912 0 0 0-1.947-.901z"/></svg> },
}

function AgentCard({ agent }: { agent: Agent }) {
  const socials = Object.entries(ICONS)
    .map(([key, def]) => ({ key, ...def, href: agent[key as keyof Agent] as string | null }))
    .filter(s => s.href)

  return (
    <div style={{ background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Photo 3:4 */}
      <div style={{ width: '100%', aspectRatio: '3/4', background: '#f0ede8', overflow: 'hidden', position: 'relative' }}>
        {agent.photo_url
          ? <img src={agent.photo_url} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
          : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, color: '#ccc' }}>👤</div>
          )
        }
      </div>

      {/* Info */}
      <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111', letterSpacing: '-.02em', lineHeight: 1.2, marginBottom: 8 }}>
            {agent.name}
          </div>
          {agent.position && (
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 500,
              background: 'rgba(107,47,160,.08)', color: 'var(--primary,#6b2fa0)',
              border: '1px solid rgba(107,47,160,.15)', borderRadius: 100, padding: '3px 10px',
            }}>
              {agent.position}
            </span>
          )}
        </div>

        {/* Contact */}
        {(agent.phone || agent.email) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {agent.phone && (
              <a href={`https://wa.me/${agent.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
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
        )}

        {/* Social icons */}
        {socials.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {socials.map(s => (
              <SocialIcon key={s.key} href={s.href!} label={s.label} color={s.color} icon={s.svg} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SocialIcon({ href, label, color, icon }: { href: string; label: string; color: string; icon: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      style={{
        width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e8e4df',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#888', textDecoration: 'none', flexShrink: 0,
        transition: 'color .15s, border-color .15s, background .15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.color = color; el.style.borderColor = color
        el.style.background = `${color}12`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.color = '#888'; el.style.borderColor = '#e8e4df'; el.style.background = '#fff'
      }}
    >
      {icon}
    </a>
  )
}
