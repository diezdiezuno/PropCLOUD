import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import ContactoClient from './ContactoClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contacto' }

export default async function ContactoPage() {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  return (
    <ContactoClient
      whatsapp={config?.whatsapp ?? null}
      email={config?.contact_email ?? null}
      address={config?.address ?? null}
      instagram={config?.instagram ?? null}
      facebook={config?.facebook ?? null}
      linkedin={config?.linkedin ?? null}
      youtube={config?.youtube ?? null}
      tiktok={config?.tiktok ?? null}
      twitter={config?.twitter ?? null}
    />
  )
}
