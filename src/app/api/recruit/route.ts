import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { domainCandidates } from '@/lib/tenant'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Formulario público: mismo límite que contact (5 envíos / 10 min por IP)
// para que no lo usen de spam. En memoria por instancia: suficiente acá.
const RATE = new Map<string, number[]>()
const RATE_MAX = 5, RATE_WINDOW = 10 * 60_000
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (RATE.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  hits.push(now)
  RATE.set(ip, hits)
  if (RATE.size > 5000) for (const [k, v] of RATE) if (v.every(t => now - t >= RATE_WINDOW)) RATE.delete(k)
  return hits.length > RATE_MAX
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Demasiados envíos. Esperá unos minutos.' }, { status: 429 })
    }
    const domain = request.headers.get('x-tenant-domain') ?? 'localhost'
    const body = await request.json()
    const { nombre, apellido, telefono, email, zona, perfil, ocupacion, motivacion, cv_link, linkedin } = body

    if (!nombre || !apellido || !email || !telefono || !perfil) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    // Resolve tenant
    let { data: tenant } = await supabase
      .from('tenants').select('id, name')
      .in('domain', domainCandidates(domain)).limit(1).single()
    if (!tenant) {
      const { data: fallback } = await supabase
        .from('tenants').select('id, name').limit(1).single()
      tenant = fallback
    }
    if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

    // Get notification emails from tenant config
    const { data: cfg } = await supabase
      .from('tenant_config')
      .select('pages_config, contact_email, contact_email_2')
      .eq('tenant_id', tenant.id)
      .single()

    const pages = (cfg?.pages_config as Array<{ slug: string; settings?: { notification_emails?: string } }> | null) ?? []
    const reclutSettings = pages.find(p => p.slug === 'reclutamiento')?.settings ?? {}
    const notifEmails = (reclutSettings.notification_emails ?? '')
      .split(',').map((e: string) => e.trim()).filter(Boolean)

    // Fallback to contact_email / contact_email_2
    const cfgData = cfg as Record<string, string | null> | null
    if (notifEmails.length === 0) {
      if (cfgData?.contact_email) notifEmails.push(cfgData.contact_email)
      if (cfgData?.contact_email_2) notifEmails.push(cfgData.contact_email_2)
    }

    // Save lead to DB
    const { error: insertError } = await supabase.from('leads').insert({
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
    if (insertError) console.error('[recruit] DB insert error:', JSON.stringify(insertError))

    // Send email notification
    if (notifEmails.length > 0) {
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
          <td style="padding:12px 20px;font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;border-bottom:1px solid #f0f0f0;vertical-align:top;width:140px;">${label}</td>
          <td style="padding:12px 20px;font-size:14px;color:#111;border-bottom:1px solid #f0f0f0;line-height:1.6;word-break:break-word;">${value}</td>
        </tr>`).join('')

      // El envoltorio (encabezado, marca, pie) lo pone send-email.
      const html = `
        <p style="font-size:14px;color:#666;margin:0 0 28px;line-height:1.7;">
          Se recibió una nueva aplicación. A continuación los datos del candidato:
        </p>
        <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #ebebeb;">
          ${tableRows}
        </table>`

      // Todo el correo transaccional sale por send-email.
      const mail = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          to: notifEmails,
          reply_to: email,
          kind: 'reclutamiento',
          subject: `Nueva aplicación — ${nombre} ${apellido} (${perfilLabel[perfil] ?? perfil})`,
          heading: 'Nueva aplicación de reclutamiento',
          body_html: html,
          footnote: 'Respondé este email para contactar al candidato.',
        }),
      })
      if (!mail.ok) console.error('[recruit] send-email:', (await mail.text()).slice(0, 300))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[recruit]', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
