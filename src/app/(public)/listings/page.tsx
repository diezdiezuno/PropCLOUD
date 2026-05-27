import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import ListingsClient from './ListingsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Propiedades' }

export default async function ListingsPage() {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  return (
    <ListingsClient
      defaultView={(config?.listing_view) ?? 'grid'}
      defaultCols={config?.listing_cols ?? 3}
      defaultSort={config?.listing_sort ?? 'price_asc'}
      enabledViews={(config?.listing_views as string[] | null) ?? ['grid', 'hover', 'dual', 'list']}
    />
  )
}
