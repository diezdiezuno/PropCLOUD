'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Tenant, TenantConfig, PageConfig } from '@/types'

interface Props {
  tenant: Tenant | null
  config: TenantConfig | null
}

// Fixed-order items always present; configurable items respect pagesConfig order
const FIXED_NAV = [
  { href: '/',         label: 'Inicio',      slug: 'inicio',      order: 0 },
  { href: '/listings', label: 'Propiedades', slug: 'propiedades', order: 1 },
]
const CONFIGURABLE_NAV = [
  { href: '/about',         label: 'Nosotros',         slug: 'nosotros',      defaultVisible: true,  defaultOrder: 2 },
  { href: '/listar',        label: 'Listar propiedad', slug: 'listar',        defaultVisible: true,  defaultOrder: 3 },
  { href: '/contact',       label: 'Contacto',         slug: 'contacto',      defaultVisible: true,  defaultOrder: 4 },
  { href: '/reclutamiento', label: 'Reclutamiento',    slug: 'reclutamiento', defaultVisible: false, defaultOrder: 5 },
]

function getNavLinks(pagesConfig: PageConfig[] | null) {
  const configurable = CONFIGURABLE_NAV
    .map(l => {
      const cfg = pagesConfig?.find(p => p.slug === l.slug)
      return {
        href: l.href,
        label: l.label,
        slug: l.slug,
        visible: cfg ? cfg.visible : l.defaultVisible,
        order: cfg ? cfg.order + 10 : l.defaultOrder,  // +10 so fixed items always come first
      }
    })
    .filter(l => l.visible)
  // Custom pages from config
  const customs = (pagesConfig ?? [])
    .filter(p => p.custom && p.visible)
    .map(p => ({ href: `/${p.slug}`, label: p.title, slug: p.slug, visible: true, order: p.order + 10 }))
  return [
    ...FIXED_NAV.map(l => ({ ...l, visible: true })),
    ...[...configurable, ...customs].sort((a, b) => a.order - b.order),
  ]
}

export default function Footer({ tenant, config }: Props) {
  const pathname = usePathname()
  const isMobile = useIsMobile()

  const path = pathname ?? ''
  if (!tenant) return null

  const navLinks  = getNavLinks(config?.pages_config ?? null)
  const hasContact = config?.contact_email || config?.whatsapp || config?.address
  const hasSocial  = config?.instagram || config?.facebook || config?.linkedin ||
                     config?.youtube  || config?.tiktok   || config?.twitter
  const logoUrl    = config?.footer_logo_url || tenant.logo_url
  const year       = new Date().getFullYear()

  return (
    <>
      {/* ── Main footer — 4-col grid ── */}
      <footer style={{
        background: '#f7f7f7',
        padding: isMobile ? '36px 16px 16px' : '44px 40px 24px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr 1fr 1fr',
        gap: isMobile ? 28 : 36,
        alignItems: 'start',
      }}>

        {/* Col 1 — Logo */}
        <div>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={tenant.name}
              style={{ maxHeight: 72, maxWidth: 180, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 18, fontWeight: 700, color: '#111' }}>
              {tenant.name}
            </div>
          )}
        </div>

        {/* Col 2 — Navigation */}
        <div>
          <h5 style={colTitle}>Navegación</h5>
          {navLinks.map(l => (
            <FooterLink key={l.slug} href={l.href}>{l.label}</FooterLink>
          ))}
        </div>

        {/* Col 3 — Contact */}
        {hasContact ? (
          <div>
            <h5 style={colTitle}>Contacto</h5>
            {config?.contact_email && (
              <FooterLink href={`mailto:${config.contact_email}`}>{config.contact_email}</FooterLink>
            )}
            {config?.whatsapp && (
              <FooterLink href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`} external>
                +{config.whatsapp.replace(/^\+/, '')}
              </FooterLink>
            )}
            {config?.address && (
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 7px', lineHeight: 1.5 }}>
                {config.address}
              </p>
            )}
          </div>
        ) : <div />}

        {/* Col 4 — Social */}
        {hasSocial ? (
          <div>
            <h5 style={colTitle}>Redes sociales</h5>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {config?.instagram && <SocialLink href={config.instagram} label="Instagram"><InstagramIcon /></SocialLink>}
              {config?.facebook  && <SocialLink href={config.facebook}  label="Facebook"><FacebookIcon /></SocialLink>}
              {config?.linkedin  && <SocialLink href={config.linkedin}  label="LinkedIn"><LinkedInIcon /></SocialLink>}
              {config?.youtube   && <SocialLink href={config.youtube}   label="YouTube"><YouTubeIcon /></SocialLink>}
              {config?.tiktok    && <SocialLink href={config.tiktok}    label="TikTok"><TikTokIcon /></SocialLink>}
              {config?.twitter   && <SocialLink href={config.twitter}   label="X / Twitter"><XIcon /></SocialLink>}
            </div>
          </div>
        ) : <div />}

      </footer>

      {/* ── Footer bottom ── */}
      <div style={{
        background: '#f7f7f7',
        borderTop: '1px solid #e0e0e0',
        padding: isMobile ? '13px 16px' : '13px 40px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
      }}>
        <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
          © {year} {tenant.name}. Todos los derechos reservados.
        </p>
        <p style={{ fontSize: 11, color: '#ccc', margin: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>Powered by <a href="https://propcloud.app" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--primary,#6b2fa0)', fontWeight: 600, textDecoration: 'none' }}>PropCLOUD</a></span>
          <span style={{ color: '#ddd' }}>·</span>
          <span style={{ fontFamily: 'monospace', letterSpacing: '-0.02em', color: '#bbb' }}>dB^r&gt;</span>
        </p>
      </div>
    </>
  )
}

// ── Shared styles ────────────────────────────────────────────────────────────

const colTitle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#aaa', marginBottom: 12, fontWeight: 600, margin: '0 0 12px',
}

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const style: React.CSSProperties = { display: 'block', fontSize: 13, color: '#555', textDecoration: 'none', marginBottom: 7 }
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={style}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent,#f5a623)')}
      onMouseLeave={e => (e.currentTarget.style.color = '#555')}>{children}</a>
  }
  return <Link href={href} style={style}
    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent,#f5a623)')}
    onMouseLeave={e => (e.currentTarget.style.color = '#555')}>{children}</Link>
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={{
      width: 32, height: 32, borderRadius: 6, border: '1px solid #ddd',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#888', textDecoration: 'none', background: '#fff',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent,#f5a623)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent,#f5a623)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#888'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#ddd' }}
    >{children}</a>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────
function InstagramIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>
}
function FacebookIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
}
function LinkedInIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
}
function YouTubeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
}
function TikTokIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.28 8.28 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z"/></svg>
}
function XIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
}
