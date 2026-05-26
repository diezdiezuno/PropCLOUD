import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const domain = request.headers.get('x-tenant-domain')

  let tenantResult = null
  let supabaseError = null

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data, error } = await supabase
        .from('tenants')
        .select('id, slug, domain')
        .limit(5)
      tenantResult = data
      supabaseError = error?.message
    } catch (e: any) {
      supabaseError = e.message
    }
  }

  return NextResponse.json({
    env: {
      supabaseUrl: supabaseUrl ? '✓ set' : '✗ missing',
      serviceKey: serviceKey ? `✓ set (${serviceKey.length} chars)` : '✗ missing',
      mapboxToken: mapboxToken ? `✓ set (${mapboxToken.slice(0, 10)}...)` : '✗ missing',
    },
    headers: {
      'x-tenant-domain': domain ?? 'not set',
    },
    supabase: {
      tenants: tenantResult,
      error: supabaseError,
    },
  })
}
