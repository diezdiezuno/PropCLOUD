import { NextRequest, NextResponse } from 'next/server'
import { verifySuperAdmin, serviceClient } from '@/lib/superadmin'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const db = serviceClient()
  const { data: tenant } = await db.from('tenants').select('*').eq('id', id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: admins } = await db
    .from('tenant_admins')
    .select('id, user_id, role, created_at')
    .eq('tenant_id', id)

  // Resolve emails from auth.users
  const enrichedAdmins = await Promise.all((admins ?? []).map(async a => {
    const { data: { user } } = await db.auth.admin.getUserById(a.user_id)
    return { ...a, email: user?.email ?? a.user_id }
  }))

  const { data: sources } = await db.from('property_sources').select('*').eq('tenant_id', id)

  return NextResponse.json({ tenant, admins: enrichedAdmins, sources: sources ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json()

  // Only allow updating safe fields
  const allowed: Record<string, unknown> = {}
  if (body.name)     allowed.name     = body.name
  if (body.domain)   allowed.domain   = body.domain.toLowerCase().trim()
  if (body.logo_url !== undefined) allowed.logo_url = body.logo_url || null
  if (body.theme)    allowed.theme    = body.theme

  const { data, error } = await serviceClient()
    .from('tenants').update(allowed).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { error } = await serviceClient().from('tenants').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
