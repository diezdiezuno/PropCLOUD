import { NextRequest, NextResponse } from 'next/server'
import { verifySuperAdmin, serviceClient } from '@/lib/superadmin'
import { inviteAdmin } from '@/lib/invite-admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: tenantId } = await params
  const { email } = await request.json()
  const cleanEmail = email?.toLowerCase().trim()
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const db = serviceClient()

  // Ya tiene cuenta → se agrega directo a tenant_admins (no hace falta invitar).
  const { data: { users } } = await db.auth.admin.listUsers()
  const user = users.find(u => u.email === cleanEmail)
  if (user) {
    const { error } = await db.from('tenant_admins').insert({ tenant_id: tenantId, user_id: user.id })
    if (error) {
      const msg = error.message.includes('unique') ? 'Este usuario ya es admin de este tenant' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ ok: true, user_id: user.id, email: cleanEmail })
  }

  // No existe → se invita: invitación role=admin + email con link de registro.
  const { data: tenant } = await db.from('tenants').select('name, slug').eq('id', tenantId).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

  const adminInvite = await inviteAdmin(db, tenantId, tenant.name, tenant.slug, cleanEmail)
  return NextResponse.json({ ok: true, invited: true, email: cleanEmail, adminInvite })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: tenantId } = await params
  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { error } = await serviceClient()
    .from('tenant_admins')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
