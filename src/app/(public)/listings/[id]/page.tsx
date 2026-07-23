import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import PropertyDetailClient from './PropertyDetailClient'
import type { Metadata } from 'next'
import type { Property } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

async function fetchProperty(host: string, domain: string, id: string): Promise<Property | null> {
  try {
    const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const res = await fetch(`${proto}://${host}/api/properties`, {
      headers: { 'x-tenant-domain': domain },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const list: Property[] = await res.json()
    return list.find(p => p.id === id) ?? null
  } catch { return null }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? ''
  const host = h.get('host') ?? 'localhost'

  const prop = await fetchProperty(host, domain, id)
  if (!prop) return { title: 'Propiedad' }

  const siteUrl = `https://${host}`
  const url = `${siteUrl}/listings/${id}`
  const title = prop.title
  const rawDesc = prop.description_es ?? prop.description ?? ''
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + '…' : rawDesc || title
  const image = prop.images?.[0] ?? undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      ...(image && { images: [{ url: image, width: 1200, height: 800, alt: title }] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image] }),
    },
    alternates: { canonical: `/listings/${id}` },
  }
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const host = h.get('host') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  // Fetch property for JSON-LD (same call as metadata, cached by Next.js)
  const prop = await fetchProperty(host, domain, id)
  const siteUrl = `https://${host}`

  const jsonLd = prop ? {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: prop.title,
    description: prop.description_es ?? prop.description ?? undefined,
    url: `${siteUrl}/listings/${id}`,
    ...(prop.images?.length && { image: prop.images }),
    ...(prop.price && {
      offers: {
        '@type': 'Offer',
        price: prop.price,
        priceCurrency: prop.currency ?? 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
    ...((prop.city || prop.country || prop.address) && {
      address: {
        '@type': 'PostalAddress',
        ...(prop.address && { streetAddress: prop.address }),
        ...(prop.city && { addressLocality: prop.city }),
        ...(prop.country && { addressCountry: prop.country }),
      },
    }),
    ...(prop.bedrooms != null && { numberOfRooms: prop.bedrooms }),
    ...(prop.area_m2 != null && { floorSize: { '@type': 'QuantitativeValue', value: prop.area_m2, unitCode: 'MTK' } }),
    ...(tenant?.name && { provider: { '@type': 'RealEstateAgent', name: tenant.name } }),
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // Escapar < evita que un título/descripción con "</script>" rompa
          // el bloque JSON-LD e inyecte HTML en la página pública (XSS).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <PropertyDetailClient
        id={id}
        layout={(config?.detail_layout ?? 'C') as 'A' | 'B' | 'C' | 'D'}
        contactMode={config?.detail_contact_mode ?? 'agent'}
        officeWhatsapp={config?.whatsapp ?? null}
        officeEmail={config?.contact_email ?? null}
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
      />
    </>
  )
}
