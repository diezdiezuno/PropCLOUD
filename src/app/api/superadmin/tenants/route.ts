import { NextRequest, NextResponse } from 'next/server'
import { verifySuperAdmin, serviceClient } from '@/lib/superadmin'

export async function GET(request: NextRequest) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = serviceClient()
  const { data: tenants } = await db
    .from('tenants')
    .select('id, slug, name, domain, logo_url, created_at')
    .order('created_at', { ascending: false })

  // Enrich with counts
  const enriched = await Promise.all((tenants ?? []).map(async t => {
    const [{ count: adminCount }, { count: sourceCount }] = await Promise.all([
      db.from('tenant_admins').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
      db.from('property_sources').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
    ])
    return { ...t, adminCount: adminCount ?? 0, sourceCount: sourceCount ?? 0 }
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { name, slug, domain } = await request.json()
  if (!name || !slug || !domain) {
    return NextResponse.json({ error: 'name, slug and domain are required' }, { status: 400 })
  }

  const db = serviceClient()
  const { data, error } = await db
    .from('tenants')
    .insert({ name, slug: slug.toLowerCase().trim(), domain: domain.toLowerCase().trim() })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('unique')
      ? 'El slug o dominio ya existe'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Create empty tenant_config
  await db.from('tenant_config').insert({ tenant_id: data.id })

  return NextResponse.json(data, { status: 201 })
}
