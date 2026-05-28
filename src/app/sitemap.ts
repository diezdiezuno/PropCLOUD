import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import { createClient } from '@supabase/supabase-js'
import type { MetadataRoute } from 'next'
import type { Property } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? h.get('host') ?? 'localhost'

  let siteUrl = `https://${domain}`
  let tenantId: string | null = null
  let pagesConfig = null

  try {
    const tenant = await getTenantByDomain(domain)
    if (tenant) {
      siteUrl = `https://${tenant.domain}`
      tenantId = tenant.id
      const config = await getTenantConfig(tenant.id).catch(() => null)
      pagesConfig = config?.pages_config ?? null
    }
  } catch {}

  const now = new Date()

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`,         lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${siteUrl}/listings`, lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
  ]

  // Configured pages
  const pageRoutes: MetadataRoute.Sitemap = (pagesConfig ?? [])
    .filter(p => p.visible)
    .map(p => ({
      url: `${siteUrl}/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

  // Property pages
  let propertyRoutes: MetadataRoute.Sitemap = []
  if (tenantId) {
    try {
      // Try manual properties first
      const { data: manualProps } = await supabase
        .from('properties')
        .select('id, created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')

      if (manualProps?.length) {
        propertyRoutes = manualProps.map(p => ({
          url: `${siteUrl}/listings/${p.id}`,
          lastModified: new Date(p.created_at),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }))
      } else {
        // Fall back to API (external source like RE/MAX)
        const host = h.get('host') ?? domain
        const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
        const res = await fetch(`${proto}://${host}/api/properties`, {
          headers: { 'x-tenant-domain': domain },
          next: { revalidate: 3600 },
        })
        if (res.ok) {
          const props: Property[] = await res.json()
          propertyRoutes = props.map(p => ({
            url: `${siteUrl}/listings/${p.id}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          }))
        }
      }
    } catch {}
  }

  return [...staticRoutes, ...pageRoutes, ...propertyRoutes]
}
