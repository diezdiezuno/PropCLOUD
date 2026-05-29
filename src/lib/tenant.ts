import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from './supabase'
import type { Tenant, TenantConfig } from '@/types'

/** Simple anon client — no cookies needed, safe to call anywhere */
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** The root domain of the platform (e.g. propcloud.app).
 *  Set APP_DOMAIN in env vars. Defaults to propcloud.app. */
const APP_DOMAIN = process.env.APP_DOMAIN ?? 'propcloud.app'

/** Resolve a request host to a tenant.
 *
 *  Rules (in order):
 *  1. propcloud.app / www.propcloud.app  → null  (landing page)
 *  2. {slug}.propcloud.app              → lookup by slug
 *  3. any other domain                  → lookup by domain (custom domain)
 *  4. localhost / *.localhost (dev)     → fallback to first tenant
 */
export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  // Use a simple client (no cookies) — tenant lookup is public, no auth needed
  const supabase = publicClient()

  // 1. Root app domain → no tenant, show landing page
  if (domain === APP_DOMAIN || domain === `www.${APP_DOMAIN}`) {
    return null
  }

  // 2. Subdomain of app domain → lookup by slug
  if (domain.endsWith(`.${APP_DOMAIN}`)) {
    const slug = domain.slice(0, domain.length - APP_DOMAIN.length - 1)
    const { data } = await supabase
      .from('tenants').select('*').eq('slug', slug).single()
    return data ?? null
  }

  // 3. Custom domain → lookup by exact domain match
  if (!domain.includes('localhost') && !domain.endsWith('.localhost')) {
    const { data } = await supabase
      .from('tenants').select('*').eq('domain', domain).single()
    return data ?? null
  }

  // 4. localhost (dev) → fallback to first tenant so local dev works
  const { data } = await supabase
    .from('tenants').select('*').limit(1).single()
  return data ?? null
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  // Use the public anon client — tenant_config is read by public pages and
  // must not require an authenticated session. RLS must have a public-read policy.
  const supabase = publicClient()
  const { data } = await supabase
    .from('tenant_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()
  return data
}

export const DEFAULT_THEME = {
  primaryColor: '#6b2fa0',
  accentColor: '#f59e0b',
  fontHeading: 'Playfair Display',
  fontBody: 'Outfit',
  mapStyle: 'mapbox://styles/mapbox/streets-v12',
}
