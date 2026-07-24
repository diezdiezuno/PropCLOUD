// Invita a un admin de tenant: crea la invitación (role=admin) y le manda el
// email con el link de registro. Lo usan el alta de tenant y el alta de admin
// sobre un tenant existente. El link va por slug.noduus.com para que funcione
// aunque el dominio custom todavía no tenga DNS. Al activar, el trigger
// users_sync_tenant_admins crea la fila en tenant_admins.

/** Devuelve el link de registro; incluye `warning` si el email no salió. */
export async function inviteAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, tenantId: string, tenantName: string, slug: string, email: string,
): Promise<{ warning?: string; link?: string }> {
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
          Te dejamos como administrador/a de <strong>${office}</strong> en Noduus.
          Creá tu cuenta para entrar a configurar el sitio, tu equipo y las propiedades.
        </p>`,
      cta: { label: 'Crear mi cuenta →', url: link },
      footnote: 'El enlace expirará en 7 días.',
    }),
  }).catch(() => null)

  if (!mail || !mail.ok) return { warning: 'La invitación se creó pero el email falló', link }
  return { link }
}
