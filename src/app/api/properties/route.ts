import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRemaxCCAProperties } from '@/lib/providers/remax-cca'
import type { Property } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const domain = request.headers.get('x-tenant-domain') ?? 'localhost'

  // Get tenant — fallback to first tenant for preview/dev domains
  let { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('domain', domain)
    .single()

  if (!tenant) {
    const { data: fallback } = await supabase
      .from('tenants')
      .select('id, slug')
      .limit(1)
      .single()
    tenant = fallback
  }

  if (!tenant) {
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
  }

  // Get property sources for this tenant
  const { data: sources } = await supabase
    .from('property_sources')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)

  if (!sources || sources.length === 0) {
    return NextResponse.json([])
  }

  let properties: Property[] = []

  for (const source of sources) {
    if (source.type === 'remax_cca') {
      const officeId = source.config?.officeId
      if (officeId) {
        const props = await fetchRemaxCCAProperties(officeId, tenant.id)
        properties = [...properties, ...props]
      }
    }
    // TODO: manual and custom_api providers
  }

  return NextResponse.json(properties, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
  })
}
