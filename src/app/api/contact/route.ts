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
    const { name, email, phone, message, source, property_id, property_title, property_url, listar_metadata } = body

    // Resolve tenant (with logo)
    let { data: tenant } = await supabase
      .from('tenants').select('id, name, logo_url').eq('domain', domain).single()
    if (!tenant) {
      const { data: fallback } = await supabase
        .from('tenants').select('id, name, logo_url').limit(1).single()
      tenant = fallback
    }
    if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

    // Get notification emails
    const { data: cfg } = await supabase
      .from('tenant_config')
      .select('contact_email, contact_email_2')
      .eq('tenant_id', tenant.id)
      .single()

    const cfgData = cfg as Record<string, string | null> | null
    const notifEmails = [cfgData?.contact_email, cfgData?.contact_email_2].filter(Boolean) as string[]

    // Build metadata
    let metadata: Record<string, string> | null = null
    if (listar_metadata) {
      metadata = listar_metadata
    } else if (source === 'propiedad') {
      metadata = {
        ...(property_title ? { property_title } : {}),
        ...(property_url   ? { property_url }   : {}),
      }
    }

    // Save lead
    const { error: insertError } = await supabase.from('leads').insert({
      tenant_id: tenant.id,
      property_id: property_id ?? null,
      name: name ?? '',
      email: email ?? null,
      phone: phone ?? null,
      message: message ?? null,
      source: source ?? 'contacto',
      metadata,
    })
    if (insertError) console.error('[contact] DB insert error:', JSON.stringify(insertError))

    // Send email notification
    if (resend && notifEmails.length > 0) {
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@propcloud.app'
      const isProperty = source === 'propiedad' && property_title
      const isListar   = source === 'listar'

      const FIELD_LABELS: Record<string, string> = {
        type: 'Tipo de propiedad', transaction: 'Transacción',
        provincia: 'Provincia', canton: 'Cantón', distrito: 'Distrito',
        address: 'Dirección', finca: 'Número de finca',
        plano: 'Número de plano', plano_url: 'Plano PDF',
        price: 'Precio estimado', area: 'Área construida (m²)',
        lot: 'Área del lote (m²)', bedrooms: 'Habitaciones',
        bathrooms: 'Baños', description: 'Descripción',
        timeline: '¿Cuándo vender?', coordinates: 'Coordenadas',
        contact_pref: 'Contacto preferido',
      }

      const contactRows: [string, string][] = [
        ['Nombre',   name ?? ''],
        ['Email',    email ?? ''],
        ...(phone ? [['Teléfono', phone] as [string, string]] : []),
      ]

      const listarRows: [string, string][] = isListar && listar_metadata
        ? Object.entries(listar_metadata as Record<string, string>)
            .filter(([, v]) => v)
            .map(([k, v]) => {
              const label = FIELD_LABELS[k] ?? k
              // Render URLs and coordinates as clickable links
              let displayVal = v
              if (k === 'plano_url' || k === 'property_url') {
                displayVal = `<a href="${v}" style="color:#6b2fa0;">Ver archivo →</a>`
              } else if (k === 'coordinates') {
                const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(v)}`
                displayVal = `<a href="${mapsUrl}" style="color:#6b2fa0;" target="_blank">Ver en Google Maps →</a><br><span style="color:#999;font-size:12px;">${v}</span>`
              }
              return [label, displayVal] as [string, string]
            })
        : []

      const messageRows: [string, string][] = (!isListar && message)
        ? [['Mensaje', message]]
        : []

      const rows: [string, string][] = [...contactRows, ...listarRows, ...messageRows]

      const tableRows = rows.map(([label, value]) => `
        <tr>
          <td style="padding:12px 20px;font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;border-bottom:1px solid #f0f0f0;vertical-align:top;width:120px;">${label}</td>
          <td style="padding:12px 20px;font-size:14px;color:#111;border-bottom:1px solid #f0f0f0;line-height:1.6;word-break:break-word;">${value}</td>
        </tr>`).join('')

      const subject = isProperty
        ? `Nueva consulta — ${property_title}`
        : isListar
          ? `Nueva propiedad para listar — ${name}`
          : `Nuevo mensaje de contacto — ${name}`

      const logoHtml = (tenant as Record<string, string | null>).logo_url
        ? `<img src="${(tenant as Record<string, string | null>).logo_url}" alt="${tenant.name}" style="height:36px;object-fit:contain;display:block;margin-bottom:16px;">`
        : `<div style="font-size:18px;font-weight:700;color:#111;margin-bottom:16px;">${tenant.name}</div>`

      const propertyBlock = isProperty ? `
        <div style="margin-bottom:28px;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
          <div style="padding:16px 20px 12px;">
            <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">Propiedad consultada</div>
            <div style="font-size:17px;font-weight:700;color:#111;line-height:1.3;">${property_title}</div>
            ${property_url ? `<a href="${property_url}" style="display:inline-block;margin-top:10px;font-size:13px;color:#6b2fa0;text-decoration:none;font-weight:500;">Ver propiedad →</a>` : ''}
          </div>
        </div>` : ''

      const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f2;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:720px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0e0e0;">

    <!-- Header — blanco con logo -->
    <div style="background:#fff;padding:28px 48px 24px;border-bottom:1px solid #ebebeb;">
      ${logoHtml}
      <div style="font-size:22px;font-weight:700;color:#111;line-height:1.2;">${isProperty ? 'Nueva consulta de propiedad' : isListar ? 'Nueva propiedad para listar' : 'Nuevo mensaje de contacto'}</div>
      <div style="font-size:13px;color:#999;margin-top:4px;">${tenant.name}</div>
    </div>

    <!-- Body -->
    <div style="padding:36px 48px;">
      ${propertyBlock}
      <div style="font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:14px;">Datos del contacto</div>
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #ebebeb;">
        ${tableRows}
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 48px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
      <p style="font-size:12px;color:#bbb;margin:0;line-height:1.6;">
        Enviado automáticamente desde ${tenant.name}. Respondé este email para contactar al cliente directamente.
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
