import type { Property } from '@/types'

interface CCAProperty {
  ListingId: string
  PropertyType: string
  TransactionType: string
  ListingTitle: string
  PublicRemarks: string
  ListPrice: number
  CurrencyType: string
  Bedrooms: number
  Bathrooms: number
  LotSize: number
  Address: string
  City: string
  Country: string
  Latitude: string
  Longitude: string
  Images: string
  FirstName: string
  LastName: string
  CellPhone: string
  Email: string
}

export async function fetchRemaxCCAProperties(
  officeId: string,
  tenantId: string
): Promise<Property[]> {
  const url = `https://api.remax-cca.com/api/PropertiesPerOffice/${officeId}?json=true`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []

  const raw: CCAProperty[] = await res.json()

  return raw.map((p) => ({
    id: p.ListingId,
    tenant_id: tenantId,
    external_id: p.ListingId,
    source: 'remax_cca' as const,
    type: p.PropertyType ?? 'Residential',
    transaction: p.TransactionType?.toLowerCase().includes('rent') ? 'rent' : 'sale',
    title: p.ListingTitle ?? '',
    description: p.PublicRemarks ?? null,
    price: p.ListPrice ?? 0,
    currency: p.CurrencyType === 'CRC' ? 'CRC' : 'USD',
    bedrooms: p.Bedrooms ?? null,
    bathrooms: p.Bathrooms ?? null,
    area_m2: p.LotSize ?? null,
    address: p.Address ?? null,
    city: p.City ?? null,
    country: p.Country ?? null,
    lat: p.Latitude ? parseFloat(p.Latitude) : null,
    lng: p.Longitude ? parseFloat(p.Longitude) : null,
    images: p.Images ? p.Images.split('|').filter(Boolean) : [],
    status: 'active' as const,
    agent_name: p.FirstName && p.LastName ? `${p.FirstName} ${p.LastName}` : null,
    agent_phone: p.CellPhone ?? null,
    agent_email: p.Email ?? null,
    created_at: new Date().toISOString(),
  }))
}
