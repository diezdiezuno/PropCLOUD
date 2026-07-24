// send-email — unico punto de salida de correo transaccional.
//
// Deploy:  supabase functions deploy send-email --no-verify-jwt --project-ref <ref>
// Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (opcional, default noreply@noduus.com)
//
// Recibe:  {
//   tenant_id,            // de quien es la marca del correo
//   to: string | string[],
//   subject,
//   heading,              // titulo dentro de la franja oscura
//   body_html,            // contenido ya armado (parrafos, tablas, lo que sea)
//   cta?: { label, url },
//   footnote?,            // letra chica bajo el separador
//   reply_to?,
//   kind?                 // etiqueta para el registro: 'invitacion', 'contacto'...
// }
//
// Por que existe: habia tres plantillas HTML separadas —invitacion, contacto y
// reclutamiento— que ya habian empezado a divergir, y cada una hablaba con
// Resend por su cuenta. Con esto el diseno vive en un solo lugar, la marca del
// tenant se resuelve desde la base en vez de viajar como parametro, y queda un
// unico sitio donde registrar lo que se envia.
//
// Los correos de auth (recuperacion, magic link) todavia salen por el mailer de
// Supabase y no pasan por aca: para moverlos hay que generar el enlace con
// auth.admin.generateLink() y mandarlo desde este mismo lugar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface Brand { name: string; primary: string }

/** El layout. Unico lugar donde se decide como se ve un correo. */
function render(b: Brand, o: {
  heading: string; bodyHtml: string
  cta?: { label: string; url: string } | null
  footnote?: string | null
}) {
  const cta = o.cta?.url
    ? `<a href="${esc(o.cta.url)}" style="display:inline-block;background:${b.primary};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:10px;">${esc(o.cta.label)}</a>`
    : ''
  const foot = o.footnote
    ? `<div style="height:1px;background:#eceef1;margin:24px 0;"></div>
       <p style="margin:0;font-size:12px;color:#9aa1ad;line-height:1.6;">${o.footnote}</p>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e5ea;">
        <tr><td style="background:#111;padding:28px 32px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#fff;margin-bottom:12px;">Noduus</div>
          <div style="color:#fff;font-size:17px;font-weight:700;">${esc(o.heading)}</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          ${o.bodyHtml}
          ${cta}
          ${foot}
        </td></tr>
        <tr><td style="background:#f4f5f7;border-top:1px solid #e2e5ea;padding:14px 32px;">
          <span style="font-size:12px;font-weight:800;color:#111;">Noduus</span>
          <span style="font-size:11px;color:#9aa1ad;float:right;">${esc(b.name)}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Solo el backend (contact/recruit/invite-agent, que tienen el service role)
  // puede disparar correos. Sin esto la función es un relay abierto: como se
  // despliega con --no-verify-jwt y CORS *, cualquiera con la URL mandaría
  // correos con HTML arbitrario desde el dominio del tenant (SPF/DKIM válidos).
  //
  // No se compara el string exacto contra el service role inyectado: una
  // rotación de llaves legacy deja a Vercel con la vieja y a la función con la
  // nueva —ambas válidas— y todo correo desde Vercel caía en 401 callado. Se
  // valida el privilegio: crear un cliente con el token y tocar la API admin,
  // que solo un service_role puede. La anon (pública, embebida en las tools) no
  // pasa, así que la propiedad anti-relay se mantiene.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  let authorized = !!token && token === expected
  if (!authorized && token) {
    const probe = createClient(Deno.env.get('SUPABASE_URL') ?? '', token)
    const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 })
    authorized = !error
  }
  if (!authorized) return json({ error: 'No autorizado' }, 401)

  const started = Date.now()
  let payload: Record<string, unknown> = {}

  try {
    payload = await req.json()
    const { tenant_id, to, subject, heading, body_html, cta, footnote, reply_to, kind } = payload as {
      tenant_id?: string; to?: string | string[]; subject?: string; heading?: string
      body_html?: string; cta?: { label: string; url: string }; footnote?: string
      reply_to?: string; kind?: string
    }

    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean) as string[]
    if (recipients.length === 0) return json({ error: 'to es requerido' }, 400)
    if (!subject)   return json({ error: 'subject es requerido' }, 400)
    if (!body_html) return json({ error: 'body_html es requerido' }, 400)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // La marca sale de la base, no de quien llama: asi un correo no puede
    // mandarse con el nombre de otra oficina por un parametro mal puesto.
    let brand: Brand = { name: 'Noduus', primary: '#111' }
    if (tenant_id) {
      const { data: t } = await sb
        .from('tenants').select('name, theme').eq('id', tenant_id).single()
      if (t) brand = { name: t.name, primary: t.theme?.primaryColor || '#111' }
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@noduus.com'

    if (!resendKey) {
      await log(sb, { tenant_id, recipients, kind, subject, ok: false, error: 'RESEND_API_KEY no configurada' })
      return json({ ok: false, error: 'RESEND_API_KEY no configurada' }, 500)
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${brand.name} <${from}>`,
        to: recipients,
        reply_to: reply_to || undefined,
        subject,
        html: render(brand, { heading: heading || subject, bodyHtml: body_html, cta, footnote }),
      }),
    })

    const detail = await res.text()
    await log(sb, { tenant_id, recipients, kind, subject, ok: res.ok, error: res.ok ? null : detail.slice(0, 500) })

    if (!res.ok) return json({ ok: false, error: detail.slice(0, 300) }, 502)
    return json({ ok: true, ms: Date.now() - started })

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500)
  }
})

/** Registro de envios. Si la tabla no existe todavia, no rompe el envio. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function log(sb: any, r: {
  tenant_id?: string; recipients: string[]; kind?: string
  subject?: string; ok: boolean; error: string | null
}) {
  try {
    await sb.from('email_log').insert({
      tenant_id: r.tenant_id ?? null,
      recipients: r.recipients,
      kind:       r.kind ?? null,
      subject:    r.subject ?? null,
      ok:         r.ok,
      error:      r.error,
    })
  } catch { /* el registro nunca debe tumbar el envio */ }
}
