import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import ReclutamientoClient from './ReclutamientoClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null
  const pageCfg = config?.pages_config?.find(p => p.slug === 'reclutamiento')
  const description = pageCfg?.settings?.seo_description ?? 'Únete a nuestro equipo de profesionales en bienes raíces.'
  return { title: 'Reclutamiento', description }
}

export default function ReclutamientoPage() {
  return <ReclutamientoClient />
}
