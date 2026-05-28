import { headers } from 'next/headers'
import { getTenantByDomain } from '@/lib/tenant'
import type { MetadataRoute } from 'next'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? h.get('host') ?? 'localhost'

  let siteUrl = `https://${domain}`
  try {
    const tenant = await getTenantByDomain(domain)
    if (tenant?.domain) siteUrl = `https://${tenant.domain}`
  } catch {}

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
