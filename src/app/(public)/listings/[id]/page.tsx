import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import PropertyDetailClient from './PropertyDetailClient'

interface Props {
  params: Promise<{ id: string }>
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
      contactMode={config?.detail_contact_mode ?? 'agent'}
      officeWhatsapp={config?.whatsapp ?? null}
      officeEmail={config?.contact_email ?? null}
    />
  )
}
