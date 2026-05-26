import { createServerSupabaseClient } from './supabase'
import type { Tenant, TenantConfig } from '@/types'

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('domain', domain)
    .single()
  return data
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  const supabase = await createServerSupabaseClient()
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
