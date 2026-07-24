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

// El admin de auth no filtra por correo, hay que recorrer las paginas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findUserByEmail(sb: any, email: string) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return null
    const users = data?.users ?? []
    const hit = users.find((u: { email?: string }) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (users.length < 1000) return null
  }
  return null
}

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
    // Se trae el dominio del tenant para decirle al cliente adónde mandar a la
    // persona: el admin resuelve el tenant por dominio, asi que entrar al
    // dashboard desde otro host la rebota con wrong_tenant.
    const { data: invite } = await sb
      .from('invitations')
      .select('id, tenant_id, email, job_title, role, expires_at, tenants(domain)')
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
      const already = createErr.message?.toLowerCase().includes('already')
      if (!already) return json({ error: createErr.message }, 400)

      // Ya hay una cuenta con ese correo. Puede ser real, o el resto de un
      // intento fallido: el registro anterior hacía signUp desde el navegador
      // y, al exigir el proyecto confirmación por email, dejaba la cuenta sin
      // confirmar y sin perfil. Esa cascara bloquea la invitación para siempre.
      const existing = await findUserByEmail(sb, invite.email)
      if (!existing) return json({ error: 'Este correo ya tiene una cuenta.' }, 409)

      const { data: prof } = await sb
        .from('users').select('id').eq('auth_id', existing.id).maybeSingle()
      const { data: adm } = await sb
        .from('tenant_admins').select('user_id').eq('user_id', existing.id).maybeSingle()

      // Solo se reclama si nadie la uso nunca: sin confirmar, sin login y sin
      // perfil. Con cualquiera de esas tres, la cuenta es de alguien y cambiarle
      // la contrasena seria apropiarsela, no activarla.
      const abandonada = !existing.email_confirmed_at && !existing.last_sign_in_at && !prof && !adm
      if (!abandonada) {
        return json({
          error: 'Este correo ya tiene una cuenta. Iniciá sesión con tu contraseña, o pedile al administrador que la restablezca.',
        }, 409)
      }

      const { error: updErr } = await sb.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (updErr) return json({ error: updErr.message }, 400)
      authId = existing.id
    }

    if (!authId) return json({ error: 'No se pudo crear la cuenta' }, 500)

    // Perfil del agente. upsert por si quedó una fila de un intento previo.
    const { error: profileErr } = await sb.from('users').upsert({
      auth_id:   authId,
      name:      String(name).trim(),
      email:     invite.email,
      // El rol lo fija quien invita (agente por defecto, admin al dar de alta
      // el tenant). Con 'admin', el trigger crea la fila en tenant_admins.
      role:      invite.role === 'admin' ? 'admin' : 'agent',
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain = (invite as any).tenants?.domain ?? null
    return json({ ok: true, email: invite.email, domain })

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500)
  }
})
