import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import ContactoClient from './ContactoClient'
import ContactoClientSunrise from './ContactoClientSunrise'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null
  const pageCfg = config?.pages_config?.find(p => p.slug === 'contacto')
  const description = pageCfg?.settings?.seo_description ?? 'Ponete en contacto con nosotros. Estamos para ayudarte con tu próxima propiedad.'
  return { title: 'Contacto', description, alternates: { canonical: '/contacto' } }
}

export default async function ContactoPage() {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  const pageCfg = config?.pages_config?.find(p => p.slug === 'contacto')
  const contactProps = {
    whatsapp:  config?.whatsapp ?? null,
    email:     config?.contact_email ?? null,
    address:   config?.address ?? null,
    instagram: config?.instagram ?? null,
    facebook:  config?.facebook ?? null,
    linkedin:  config?.linkedin ?? null,
    youtube:   config?.youtube ?? null,
    tiktok:    config?.tiktok ?? null,
    twitter:   config?.twitter ?? null,
  }

  if (pageCfg?.settings?.contacto_template === 'sunrise') {
    return <ContactoClientSunrise {...contactProps} />
  }

  return <ContactoClient {...contactProps} />
}
