'use client'

import type { Tenant, TenantConfig } from '@/types'

interface Props {
  tenant: Tenant | null
  config: TenantConfig | null
}

export default function Footer({ tenant, config }: Props) {
  if (!config && !tenant) return null

  const hasContact = config?.whatsapp || config?.contact_email || config?.address
  const hasSocial = config?.instagram || config?.facebook || config?.linkedin

  if (!hasContact && !hasSocial) return null

  return (
    <footer style={{
      background: '#111',
      color: '#aaa',
      padding: '40px 24px',
      fontSize: 13,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>

        {/* Brand */}
        <div>
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} style={{ height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.8, marginBottom: 12 }} />
          ) : (
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: 'var(--font-heading, serif)' }}>
              {tenant?.name}
            </div>
          )}
          {config?.address && (
            <div style={{ color: '#666', lineHeight: 1.6 }}>{config.address}</div>
          )}
        </div>

        {/* Contact */}
        {hasContact && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#555', marginBottom: 14 }}>
              Contacto
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {config?.whatsapp && (
                <a
                  href={`https://wa.me/${config.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#aaa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <WhatsAppIcon />
                  +{config.whatsapp}
                </a>
              )}
              {config?.contact_email && (
                <a
                  href={`mailto:${config.contact_email}`}
                  style={{ color: '#aaa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <EmailIcon />
                  {config.contact_email}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Social */}
        {hasSocial && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#555', marginBottom: 14 }}>
              Redes sociales
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {config?.instagram && (
                <SocialLink href={config.instagram} label="Instagram">
                  <InstagramIcon />
                </SocialLink>
              )}
              {config?.facebook && (
                <SocialLink href={config.facebook} label="Facebook">
                  <FacebookIcon />
                </SocialLink>
              )}
              {config?.linkedin && (
                <SocialLink href={config.linkedin} label="LinkedIn">
                  <LinkedInIcon />
                </SocialLink>
              )}
            </div>
          </div>
        )}

      </div>

      <div style={{ maxWidth: 1280, margin: '32px auto 0', paddingTop: 24, borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: '#444', fontSize: 12 }}>
          © {new Date().getFullYear()} {tenant?.name}
        </span>
        <span style={{ color: '#333', fontSize: 12 }}>
          Powered by PropCLOUD
        </span>
      </div>
    </footer>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={{
      width: 36, height: 36, borderRadius: 8, border: '1px solid #2a2a2a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#666', textDecoration: 'none', transition: 'color .2s, border-color .2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#fff'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#444' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#666'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2a2a2a' }}
    >
      {children}
    </a>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <polyline points="2,4 12,13 22,4"/>
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}
