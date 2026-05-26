import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const domain = request.headers.get('x-tenant-domain')

  let serviceResult = null
  let serviceError = null
  let anonResult = null
  let anonError = null

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data, error } = await supabase.from('tenants').select('id, slug, domain').limit(5)
      serviceResult = data
      serviceError = error?.message
    } catch (e: unknown) {
      serviceError = (e as Error).message
    }
  }

  if (supabaseUrl && anonKey) {
    try {
      const supabase = createClient(supabaseUrl, anonKey)
      const { data, error } = await supabase.from('tenants').select('id, slug').limit(1)
      anonResult = data
      anonError = error?.message
    } catch (e: unknown) {
      anonError = (e as Error).message
    }
  }

  // Test exactly what getTenantByDomain does for the current domain
  let domainLookupService = null
  let domainLookupAnon = null
  if (domain && supabaseUrl && serviceKey && anonKey) {
    const svc = createClient(supabaseUrl, serviceKey)
    const anon = createClient(supabaseUrl, anonKey)
    const [sr, ar] = await Promise.all([
      svc.from('tenants').select('*').eq('domain', domain).single(),
      anon.from('tenants').select('*').eq('domain', domain).single(),
    ])
    domainLookupService = { data: sr.data, error: sr.error?.message ?? null }
    domainLookupAnon = { data: ar.data, error: ar.error?.message ?? null }
  }

  return NextResponse.json({
    env: {
      supabaseUrl: supabaseUrl ? `✓ set` : '✗ missing',
      anonKey: anonKey ? `✓ set (${anonKey.length} chars, starts: ${anonKey.slice(0, 20)}...)` : '✗ missing',
      serviceKey: serviceKey ? `✓ set (${serviceKey.length} chars)` : '✗ missing',
      mapboxToken: mapboxToken ? `✓ set (${mapboxToken.slice(0, 10)}...)` : '✗ missing',
    },
    headers: { 'x-tenant-domain': domain ?? 'not set' },
    supabaseServiceRole: { tenants: serviceResult, error: serviceError },
    supabaseAnon: { tenants: anonResult, error: anonError },
    domainLookup: { domain, service: domainLookupService, anon: domainLookupAnon },
  })
}
