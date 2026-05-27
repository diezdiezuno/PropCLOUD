import type { Property } from '@/types'

// Field names from the real RE/MAX CCA API response
interface CCAProperty {
  ListingId: string | number
  // Type
  PropertyTypeName_es: string
  PropertyTypeName_en: string
  // Transaction
  ContractType_en: string      // 'Sale', 'Rent', 'Lease'
  // Title & description
  ListingTitle_en: string
  ListingTitle_es: string
  PublicRemarks_en: string
  PublicRemarks_es: string
  // Price
  ListPrice: number
  CurrencyListPrice: string    // includes 'CRC' for Colon properties
  // Stats
  BedroomsTotal: number
  BathroomsFull: number
  ConstructionSize: number     // m² construction
  LotSizeArea: number          // m² lot
  // Location
  Location: string             // city / neighborhood
  StateDepProv: string         // province
  Country: string
  Latitude: string
  Longitude: string
  // Media
  Images: string               // pipe-separated URLs
  // Agent
  FirstName: string
  LastName: string
  CellPhone: string
  Email: string
  OfficeName: string
  // Amenities (Y/N strings)
  Garage: string
  PoolPrivate: string
  Viewyn: string
  Cooling: string
  GatedCommunity: string
  MaidRoom: string
}

export async function fetchRemaxCCAProperties(
  officeId: string,
  tenantId: string
): Promise<Property[]> {
  const url = `https://api.remax-cca.com/api/PropertiesPerOffice/${officeId}?json=true`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []

  const raw: CCAProperty[] = await res.json()

  return raw.map((p) => {
    const isRent = p.ContractType_en === 'Rent' || p.ContractType_en === 'Lease'
    const isCRC = p.CurrencyListPrice?.includes('CRC') ?? false

    return {
      id: String(p.ListingId),
      tenant_id: tenantId,
      external_id: String(p.ListingId),
      source: 'remax_cca' as const,
      type: p.PropertyTypeName_es || p.PropertyTypeName_en || 'Residential',
      transaction: isRent ? 'rent' : 'sale',
      title: p.ListingTitle_en || p.ListingTitle_es || '',
      description: p.PublicRemarks_en || p.PublicRemarks_es || null,
      price: p.ListPrice ?? 0,
      currency: isCRC ? 'CRC' : 'USD',
      bedrooms: p.BedroomsTotal ?? null,
      bathrooms: p.BathroomsFull ?? null,
      area_m2: p.ConstructionSize ?? null,
      lot_m2: p.LotSizeArea ?? null,
      address: p.Location ?? null,
      city: [p.Location, p.StateDepProv].filter(Boolean).join(', ') || null,
      country: p.Country ?? null,
      lat: p.Latitude ? parseFloat(p.Latitude) : null,
      lng: p.Longitude ? parseFloat(p.Longitude) : null,
      images: p.Images ? p.Images.split('|').filter(Boolean) : [],
      status: 'active' as const,
      agent_name: [p.FirstName, p.LastName].filter(Boolean).join(' ') || null,
      agent_phone: p.CellPhone ?? null,
      agent_email: p.Email ?? null,
      created_at: new Date().toISOString(),
    }
  })
}
