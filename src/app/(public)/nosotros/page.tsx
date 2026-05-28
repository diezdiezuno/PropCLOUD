import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nosotros',
  description: 'Conocé nuestra historia, misión y el equipo detrás de nuestra inmobiliaria.',
}

export default async function NosotrosPage() {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  // content_html from page settings takes priority; fall back to about_html
  const pageCfg = config?.pages_config?.find(p => p.slug === 'nosotros')
  const html = pageCfg?.settings?.content_html ?? config?.about_html ?? ''

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 80px' }}>
        {html ? (
          <div
            className="prose-content"
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ fontSize: 16, lineHeight: 1.8, color: '#333' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '80px 0' }}>
            <p style={{ fontSize: 16 }}>Esta página aún no tiene contenido.</p>
          </div>
        )}
      </div>
    </div>
  )
}
