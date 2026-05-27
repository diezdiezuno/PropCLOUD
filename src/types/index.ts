export interface Tenant {
  id: string
  slug: string
  name: string
  domain: string
  tagline: string | null
  logo_url: string | null
  favicon_url: string | null
  theme: TenantTheme
  created_at: string
}

export interface TenantTheme {
  primaryColor: string
  accentColor: string
  fontHeading: string
  fontBody: string
  mapStyle: string
  // Map display options
  autoLightPreset?: boolean
  show3dObjects?: boolean
  showPoiLabels?: boolean
  showTransitLabels?: boolean
  showPlaceLabels?: boolean
  showRoadLabels?: boolean
}

export interface PageSettings {
  content_html?: string           // nosotros + custom pages
  submission_email?: string       // listar + reclutamiento: where to receive
  submission_whatsapp?: string
  listar_fields?: string[]        // which optional fields to show
  listar_intro?: string
  reclutamiento_positions?: string[]
  reclutamiento_intro?: string
}

export interface PageConfig {
  slug: string
  title: string
  visible: boolean
  order: number
  custom?: boolean   // true = added by tenant, false = predefined
  settings?: PageSettings
}

// A zone pill entry — predefined or custom (user-added via map)
export interface ZoneConfigItem {
  label: string               // display name, e.g. "Escazú"
  key: string                 // search term matched against property location
  enabled: boolean
  custom?: boolean            // true = added by tenant
  center?: [number, number, number]  // [lng, lat, zoom] for map flyTo
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
  youtube: string | null
  tiktok: string | null
  twitter: string | null
  // Branding extras
  footer_logo_url: string | null
  // Map
  map_center_lat: number | null
  map_center_lng: number | null
  map_zoom: number | null
  zone_config: ZoneConfigItem[] | null   // null = show all predefined; array = full zone list
  // Listing
  listing_view: 'grid' | 'list' | null
  listing_cols: number | null
  listing_sort: 'price_asc' | 'price_desc' | 'newest' | null
  listing_views: string[] | null          // which view modes to show in the toggle
  // Language
  default_language: 'es' | 'en' | null
  // Detail
  detail_layout: 'A' | 'B' | 'C' | 'D' | null
  detail_sections: string[] | null
  detail_contact_mode: 'agent' | 'office' | null
  // Pages
  pages_config: PageConfig[] | null       // static pages visibility config
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
  type_es: string | null
  type_en: string | null
  transaction: 'sale' | 'rent'
  title: string
  title_es: string | null
  title_en: string | null
  description: string | null
  description_es: string | null
  description_en: string | null
  price: number
  currency: 'USD' | 'CRC'
  bedrooms: number | null
  bathrooms: number | null
  area_m2: number | null
  lot_m2: number | null
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
