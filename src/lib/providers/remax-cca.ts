import { createClient } from '@supabase/supabase-js'
import { translateBatch } from '@/lib/translate'
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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function fetchRemaxCCAProperties(
  officeId: string,
  tenantId: string
): Promise<Property[]> {
  const url = `https://api.remax-cca.com/api/PropertiesPerOffice/${officeId}?json=true`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []

  const raw: CCAProperty[] = await res.json()

  // ── 1. Map raw properties ────────────────────────────────────────────────────
  const properties = raw.map((p) => {
    const isRent = p.ContractType_en === 'Rent' || p.ContractType_en === 'Lease'
    const isCRC = p.CurrencyListPrice?.includes('CRC') ?? false

    return {
      id: String(p.ListingId),
      tenant_id: tenantId,
      external_id: String(p.ListingId),
      source: 'remax_cca' as const,
      type: p.PropertyTypeName_es || p.PropertyTypeName_en || 'Residencial',
      type_es: p.PropertyTypeName_es || null,
      type_en: p.PropertyTypeName_en || null,
      transaction: isRent ? 'rent' : 'sale',
      title: p.ListingTitle_es || p.ListingTitle_en || '',
      title_es: p.ListingTitle_es || null,
      title_en: p.ListingTitle_en || null,
      description: p.PublicRemarks_es || p.PublicRemarks_en || null,
      description_es: p.PublicRemarks_es || null,
      description_en: p.PublicRemarks_en || null,
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
    } satisfies Property
  })

  // ── 2. Fill description_es via translation cache ─────────────────────────────
  // Only run if there are properties missing a Spanish description
  const needsTranslation = properties.filter(
    p => !p.description_es && p.description_en
  )

  if (needsTranslation.length > 0) {
    try {
      const supabase = getSupabase()
      const externalIds = needsTranslation.map(p => p.external_id)

      // 2a. Load existing cached translations for this tenant
      const { data: cached } = await supabase
        .from('property_translations')
        .select('external_id, source_text, description_es')
        .eq('tenant_id', tenantId)
        .in('external_id', externalIds)

      const cacheMap = new Map(
        (cached ?? []).map(r => [r.external_id, r])
      )

      // 2b. Determine which need fresh translation (not cached, or EN text changed)
      const toTranslate = needsTranslation
        .filter(p => {
          const hit = cacheMap.get(p.external_id)
          // Translate if: not in cache, OR the source English text has changed
          return !hit || hit.source_text !== p.description_en
        })
        .map(p => ({ id: p.external_id, text: p.description_en! }))

      // 2c. Translate new/changed ones
      if (toTranslate.length > 0) {
        console.log(`[remax-cca] Translating ${toTranslate.length} descriptions…`)
        const translated = await translateBatch(toTranslate)

        // 2d. Upsert into Supabase cache
        if (translated.size > 0) {
          const rows = Array.from(translated.entries()).map(([extId, descEs]) => ({
            external_id: extId,
            tenant_id: tenantId,
            source_text: toTranslate.find(t => t.id === extId)!.text,
            description_es: descEs,
            translated_at: new Date().toISOString(),
          }))

          await supabase
            .from('property_translations')
            .upsert(rows, { onConflict: 'external_id,tenant_id' })

          // Add to in-memory cache map for step 2e
          for (const row of rows) {
            cacheMap.set(row.external_id, row)
          }
        }
      }

      // 2e. Apply cached + freshly translated descriptions to properties
      for (const prop of properties) {
        if (!prop.description_es) {
          const hit = cacheMap.get(prop.external_id)
          if (hit?.description_es) {
            prop.description_es = hit.description_es
            // Also update the base description to Spanish if available
            prop.description = hit.description_es
          }
        }
      }
    } catch (err) {
      // Translation is best-effort — never let it break the main response
      console.error('[remax-cca] Translation error (non-fatal):', err)
    }
  }

  return properties
}
