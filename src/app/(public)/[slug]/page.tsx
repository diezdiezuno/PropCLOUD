import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null
  const pageCfg = config?.pages_config?.find(p => p.slug === slug)
  return { title: pageCfg?.title ?? slug, alternates: { canonical: `/${slug}` } }
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  const pageCfg = config?.pages_config?.find(p => p.slug === slug && p.custom)
  if (!pageCfg) notFound()

  const html = pageCfg.settings?.content_html ?? ''

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
          <p style={{ color: '#bbb', fontSize: 15, textAlign: 'center', paddingTop: 60 }}>
            Contenido próximamente.
          </p>
        )}
      </div>
    </div>
  )
}
