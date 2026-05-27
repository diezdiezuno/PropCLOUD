import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import PropertyDetailClient from './PropertyDetailClient'
import type { Metadata } from 'next'
import type { Property } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? ''
  const host = headersList.get('host') ?? 'localhost'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  try {
    const res = await fetch(`${proto}://${host}/api/properties`, {
      headers: { 'x-tenant-domain': domain },
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const list: Property[] = await res.json()
      const prop = list.find(p => p.id === id)
      if (prop?.title) return { title: prop.title }
    }
  } catch {}
  return { title: 'Propiedad' }
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  return (
    <PropertyDetailClient
      id={id}
      layout={(config?.detail_layout ?? 'C') as 'A' | 'B' | 'C' | 'D'}
      contactMode={config?.detail_contact_mode ?? 'agent'}
      officeWhatsapp={config?.whatsapp ?? null}
      officeEmail={config?.contact_email ?? null}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
    />
  )
}
