import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { fetchRemaxCCAProperties } from '@/lib/providers/remax-cca'
import { createClient } from '@supabase/supabase-js'
import PropertyDetail from './PropertyDetail'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getProperty(domain: string, id: string) {
  // Resolve tenant
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
  if (!tenant) return null

  const { data: sources } = await supabase
    .from('property_sources')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)

  if (!sources || sources.length === 0) return null

  for (const source of sources) {
    if (source.type === 'remax_cca') {
      const officeId = source.config?.officeId
      if (officeId) {
        const props = await fetchRemaxCCAProperties(officeId, tenant.id)
        const found = props.find(p => p.id === id)
        if (found) return found
      }
    }
  }

  return null
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'

  const property = await getProperty(domain, id)
  if (!property) notFound()

  return <PropertyDetail property={property} />
}
