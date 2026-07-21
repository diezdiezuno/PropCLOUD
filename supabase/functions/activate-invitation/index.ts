// activate-invitation — crea la cuenta de un agente invitado.
//
// Deploy:  supabase functions deploy activate-invitation --no-verify-jwt --project-ref <ref>
//
// Recibe:  { token, name, password }
//
// Por qué existe: el registro creaba la cuenta desde el navegador con signUp y
// entraba con signInWithPassword acto seguido. Eso solo funciona si el proyecto
// tiene la confirmación por email desactivada; con mailer_autoconfirm en false
// —que es como está— signUp deja la cuenta sin confirmar y el login falla con
// "Email not confirmed". Acá se crea con email_confirm: true, que es legítimo
// porque el token llegó al correo de la persona: eso ya prueba que es suyo.
//
// De paso deja de exponerse signUp con la anon key desde una página pública.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { token, name, password } = await req.json()

    if (!token)    return json({ error: 'Falta el token de invitación' }, 400)
    if (!name || !String(name).trim()) return json({ error: 'El nombre es requerido' }, 400)
    if (!password || String(password).length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // El token es la credencial: se busca por coincidencia exacta.
    const { data: invite } = await sb
      .from('invitations')
      .select('id, tenant_id, email, job_title, expires_at')
      .eq('token', token)
      .single()

    if (!invite) return json({ error: 'La invitación no existe o ya fue usada' }, 404)
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ error: 'La invitación venció. Pedile al administrador que te envíe una nueva.' }, 410)
    }

    // Cuenta ya confirmada: el correo llegó a esa casilla, no hay nada que verificar.
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    let authId = created?.user?.id

    if (createErr) {
      // Ya existía en auth. No se le cambia la contraseña: el token autoriza a
      // crear la cuenta de ese correo, no a apropiarse de una que ya alguien usa.
      const already = createErr.message?.toLowerCase().includes('already')
      if (!already) return json({ error: createErr.message }, 400)
      return json({
        error: 'Este correo ya tiene una cuenta. Iniciá sesión con tu contraseña, o pedile al administrador que la restablezca.',
      }, 409)
    }

    if (!authId) return json({ error: 'No se pudo crear la cuenta' }, 500)

    // Perfil del agente. upsert por si quedó una fila de un intento previo.
    const { error: profileErr } = await sb.from('users').upsert({
      auth_id:   authId,
      name:      String(name).trim(),
      email:     invite.email,
      role:      'agent',
      job_title: invite.job_title || null,
      tenant_id: invite.tenant_id,
    }, { onConflict: 'auth_id' })

    if (profileErr) {
      // Sin perfil la cuenta no sirve para nada: se deshace para que el agente
      // pueda reintentar con la misma invitación en vez de quedar trabado.
      await sb.auth.admin.deleteUser(authId)
      return json({ error: `No se pudo crear el perfil: ${profileErr.message}` }, 400)
    }

    await sb.from('invitations').delete().eq('id', invite.id)

    return json({ ok: true, email: invite.email })

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500)
  }
})
