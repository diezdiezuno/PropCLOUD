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
    const { name, email, phone, message, source, property_id, property_title } = body

    // Resolve tenant
    let { data: tenant } = await supabase
      .from('tenants').select('id, name').eq('domain', domain).single()
    if (!tenant) {
      const { data: fallback } = await supabase
        .from('tenants').select('id, name').limit(1).single()
      tenant = fallback
    }
    if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

    // Get contact_email from tenant config
    const { data: cfg } = await supabase
      .from('tenant_config')
      .select('contact_email, contact_email_2')
      .eq('tenant_id', tenant.id)
      .single()

    const cfgData = cfg as Record<string, string | null> | null
    const notifEmails = [cfgData?.contact_email, cfgData?.contact_email_2].filter(Boolean) as string[]

    // Save lead
    const { error: insertError } = await supabase.from('leads').insert({
      tenant_id: tenant.id,
      property_id: property_id ?? null,
      name: name ?? '',
      email: email ?? null,
      phone: phone ?? null,
      message: message ?? null,
      source: source ?? 'contacto',
    })
    if (insertError) console.error('[contact] DB insert error:', JSON.stringify(insertError))

    // Send email notification
    if (resend && notifEmails.length > 0) {
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@propcloud.app'
      const isProperty = source === 'propiedad' && property_title

      const rows: [string, string][] = [
        ['Nombre',  name ?? ''],
        ['Email',   email ?? ''],
        ...(phone   ? [['Teléfono', phone] as [string, string]] : []),
        ...(message ? [['Mensaje',  message] as [string, string]] : []),
      ]

      const tableRows = rows.map(([label, value]) => `
        <tr>
          <td style="padding:12px 20px;font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;border-bottom:1px solid #f0f0f0;vertical-align:top;width:120px;">${label}</td>
          <td style="padding:12px 20px;font-size:14px;color:#111;border-bottom:1px solid #f0f0f0;line-height:1.6;word-break:break-word;">${value}</td>
        </tr>`).join('')

      const subject = isProperty
        ? `Nueva consulta — ${property_title}`
        : `Nuevo mensaje de contacto — ${name}`

      const headerTitle = isProperty
        ? `Consulta sobre propiedad`
        : `Nuevo mensaje de contacto`

      const propertyRow = isProperty ? `
        <div style="margin-bottom:28px;padding:16px 20px;background:#f5f5f7;border-radius:10px;border:1px solid #e8e8e8;">
          <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">Propiedad</div>
          <div style="font-size:15px;font-weight:600;color:#111;">${property_title}</div>
        </div>` : ''

      const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f2;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:720px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0e0e0;">
    <div style="background:#111;padding:32px 48px;">
      <div style="font-size:12px;font-weight:500;color:rgba(255,255,255,.45);letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">${tenant.name}</div>
      <div style="font-size:24px;font-weight:700;color:#fff;line-height:1.2;">${headerTitle}</div>
    </div>
    <div style="padding:36px 48px;">
      ${propertyRow}
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #ebebeb;">
        ${tableRows}
      </table>
    </div>
    <div style="padding:20px 48px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
      <p style="font-size:12px;color:#bbb;margin:0;line-height:1.6;">
        Enviado automáticamente desde ${tenant.name}. Respondé este email para contactar al cliente.
      </p>
    </div>
  </div>
</body>
</html>`

      await resend.emails.send({
        from: fromEmail,
        to: notifEmails,
        replyTo: email ?? undefined,
        subject,
        html,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact]', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
