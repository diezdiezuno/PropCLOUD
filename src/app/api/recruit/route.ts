import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    const domain = request.headers.get('x-tenant-domain') ?? 'localhost'
    const body = await request.json()
    const { nombre, apellido, telefono, email, zona, perfil, ocupacion, motivacion, cv_link, linkedin } = body

    if (!nombre || !apellido || !email || !telefono || !zona || !perfil) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    // Resolve tenant
    let { data: tenant } = await supabase
      .from('tenants').select('id, name').eq('domain', domain).single()
    if (!tenant) {
      const { data: fallback } = await supabase
        .from('tenants').select('id, name').limit(1).single()
      tenant = fallback
    }
    if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

    // Get notification emails from tenant config
    const { data: cfg } = await supabase
      .from('tenant_config')
      .select('pages_config, contact_email')
      .eq('tenant_id', tenant.id)
      .single()

    const pages = (cfg?.pages_config as Array<{ slug: string; settings?: { notification_emails?: string } }> | null) ?? []
    const reclutSettings = pages.find(p => p.slug === 'reclutamiento')?.settings ?? {}
    const notifEmails = (reclutSettings.notification_emails ?? '')
      .split(',').map((e: string) => e.trim()).filter(Boolean)

    // Fallback to contact_email
    const contactEmail = (cfg as Record<string, string | null> | null)?.contact_email
    if (notifEmails.length === 0 && contactEmail) notifEmails.push(contactEmail)

    // Save lead to DB
    await supabase.from('leads').insert({
      tenant_id: tenant.id,
      property_id: null,
      name: `${nombre} ${apellido}`,
      email: email ?? null,
      phone: telefono ?? null,
      message: motivacion ?? null,
      source: 'reclutamiento',
      metadata: {
        apellido,
        zona: zona ?? '',
        perfil: perfil ?? '',
        ocupacion: ocupacion ?? '',
        cv_link: cv_link ?? '',
        linkedin: linkedin ?? '',
      },
    })

    // Send email notification
    if (resend && notifEmails.length > 0) {
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@propcloud.app'
      const perfilLabel: Record<string, string> = {
        nuevo: 'Nuevo en bienes raíces',
        experiencia: 'Agente con experiencia',
        otro: 'Explorando opciones',
      }

      const rows = [
        ['Nombre',     `${nombre} ${apellido}`],
        ['Email',      email],
        ['Teléfono',   telefono],
        ['Zona',       zona],
        ['Perfil',     perfilLabel[perfil] ?? perfil],
        ocupacion   ? ['Ocupación actual', ocupacion]   : null,
        motivacion  ? ['Motivación',       motivacion]  : null,
        cv_link     ? ['CV / Portfolio',   `<a href="${cv_link}" style="color:#6b2fa0;">${cv_link}</a>`] : null,
        linkedin    ? ['LinkedIn',         `<a href="${linkedin}" style="color:#6b2fa0;">${linkedin}</a>`] : null,
      ].filter(Boolean) as [string, string][]

      const tableRows = rows.map(([label, value]) => `
        <tr>
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;border-bottom:1px solid #f0f0f0;vertical-align:top;">${label}</td>
          <td style="padding:10px 16px;font-size:15px;color:#111;border-bottom:1px solid #f0f0f0;">${value}</td>
        </tr>`).join('')

      const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e8;">
    <!-- Header -->
    <div style="background:#111;padding:32px 40px;">
      <div style="font-size:13px;font-weight:500;color:rgba(255,255,255,.5);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">${tenant.name}</div>
      <div style="font-size:22px;font-weight:700;color:#fff;line-height:1.2;">Nueva aplicación de reclutamiento</div>
    </div>
    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#555;margin:0 0 24px;line-height:1.6;">
        Se recibió una nueva aplicación. A continuación los datos del candidato:
      </p>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:12px;overflow:hidden;border:1px solid #f0f0f0;">
        ${tableRows}
      </table>
    </div>
    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #f0f0f0;background:#fafafa;">
      <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
        Este mensaje fue enviado automáticamente desde ${tenant.name}.<br>
        Para responder al candidato, respondé directamente a este email.
      </p>
    </div>
  </div>
</body>
</html>`

      await resend.emails.send({
        from: fromEmail,
        to: notifEmails,
        replyTo: email,
        subject: `Nueva aplicación — ${nombre} ${apellido} (${perfilLabel[perfil] ?? perfil})`,
        html,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[recruit]', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
