export interface Tenant {
  id: string
  slug: string
  name: string
  domain: string
  logo_url: string | null
  theme: TenantTheme
  created_at: string
}

export interface TenantTheme {
  primaryColor: string
  accentColor: string
  fontHeading: string
  fontBody: string
  mapStyle: string
}

export interface TenantConfig {
  tenant_id: string
  // Content
  hero_title: string | null
  hero_subtitle: string | null
  about_html: string | null
  // Contact
  whatsapp: string | null
  contact_email: string | null
  address: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  // Map
  map_center_lat: number | null
  map_center_lng: number | null
  map_zoom: number | null
  // Listing
  listing_view: 'grid' | 'list' | null
  listing_cols: number | null
  listing_sort: 'price_asc' | 'price_desc' | 'newest' | null
  // Detail
  detail_sections: string[] | null
}

export interface PropertySource {
  id: string
  tenant_id: string
  type: 'remax_cca' | 'manual' | 'custom_api'
  config: Record<string, string>
  is_active: boolean
}

export interface Agent {
  id: string
  tenant_id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  photo_url: string | null
  bio: string | null
  is_active: boolean
}

export interface Property {
  id: string
  tenant_id: string
  external_id: string | null
  source: 'remax_cca' | 'manual' | 'custom_api'
  type: string
  transaction: 'sale' | 'rent'
  title: string
  description: string | null
  price: number
  currency: 'USD' | 'CRC'
  bedrooms: number | null
  bathrooms: number | null
  area_m2: number | null
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  images: string[]
  status: 'active' | 'inactive' | 'sold'
  agent_name: string | null
  agent_phone: string | null
  agent_email: string | null
  created_at: string
}

export interface Lead {
  id: string
  tenant_id: string
  property_id: string | null
  name: string
  email: string | null
  phone: string | null
  message: string | null
  source: string | null
  created_at: string
}
