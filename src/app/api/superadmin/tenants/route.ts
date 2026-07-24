import { NextRequest, NextResponse } from 'next/server'
import { verifySuperAdmin, serviceClient } from '@/lib/superadmin'
import { inviteAdmin } from '@/lib/invite-admin'

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
  const { name, slug, domain, admin_email } = await request.json()
  if (!name || !slug || !domain) {
    return NextResponse.json({ error: 'name, slug and domain are required' }, { status: 400 })
  }
  const adminEmail = admin_email?.toLowerCase().trim()
  if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return NextResponse.json({ error: 'Email de admin inválido' }, { status: 400 })
  }

  const cleanSlug = slug.toLowerCase().trim()
  const db = serviceClient()
  const { data, error } = await db
    .from('tenants')
    .insert({ name, slug: cleanSlug, domain: domain.toLowerCase().trim() })
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

  // Admin inicial: se crea la invitación (role=admin) y se le manda el email
  // para que entre a configurar. Reachable por slug.noduus.com aunque el
  // dominio custom todavía no tenga DNS. No es fatal: si el email falla, el
  // tenant queda creado y se devuelve el link para pasarlo a mano.
  let adminInvite: { warning?: string; link?: string } | undefined
  if (adminEmail) adminInvite = await inviteAdmin(db, data.id, name, cleanSlug, adminEmail)

  return NextResponse.json({ ...data, adminInvite }, { status: 201 })
}
