import { NextRequest, NextResponse } from 'next/server'
import { verifySuperAdmin, serviceClient } from '@/lib/superadmin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: tenantId } = await params
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = serviceClient()

  // Find user by email
  const { data: { users } } = await db.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  if (!user) {
    return NextResponse.json({ error: `No existe ningún usuario con el email: ${email}. El usuario debe hacer login al menos una vez.` }, { status: 404 })
  }

  const { error } = await db.from('tenant_admins').insert({ tenant_id: tenantId, user_id: user.id })
  if (error) {
    const msg = error.message.includes('unique') ? 'Este usuario ya es admin de este tenant' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true, user_id: user.id, email })
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
