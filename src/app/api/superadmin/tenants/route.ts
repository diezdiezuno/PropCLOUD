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

async function inviteAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, tenantId: string, tenantName: string, slug: string, email: string,
) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: invite, error } = await db
    .from('invitations')
    .insert({ tenant_id: tenantId, email, role: 'admin', invited_by: 'Noduus',
      status: 'pending', expires_at: expires })
    .select('token').single()
  if (error || !invite) return { warning: `No se pudo crear la invitación: ${error?.message}` }

  const appDomain = process.env.APP_DOMAIN ?? 'noduus.com'
  const link = `https://${slug}.${appDomain}/tools/registro/?token=${invite.token}`
  const office = tenantName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const mail = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      tenant_id: tenantId,
      to: email,
      kind: 'invitacion',
      subject: `Configurá ${tenantName} en Noduus`,
      heading: `Te damos la bienvenida a Noduus`,
      body_html: `
        <p style="margin:0 0 16px;font-size:15px;color:#111;">Hola,</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
          Creamos <strong>${office}</strong> en Noduus y te dejamos como administrador/a.
          Creá tu cuenta para entrar a configurar el sitio, tu equipo y las propiedades.
        </p>`,
      cta: { label: 'Crear mi cuenta →', url: link },
      footnote: 'El enlace expirará en 7 días.',
    }),
  }).catch(() => null)

  if (!mail || !mail.ok) return { warning: 'La invitación se creó pero el email falló', link }
  return { link }
}
