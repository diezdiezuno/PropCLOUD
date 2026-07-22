// delete-user — borra una invitación o un agente (perfil + cuenta de auth).
//
// Deploy:  supabase functions deploy delete-user --no-verify-jwt --project-ref <ref>
//          (el JWT lo valida la función; --no-verify-jwt permite responder el preflight)
//
// Recibe:  { type: 'invitation', invitation_id }
//          { type: 'user', user_id, auth_id }
//
// Solo un admin puede llamarla, y solo sobre objetos de su propio tenant:
// borrar usa service role, que se saltea RLS, así que la pertenencia hay que
// comprobarla acá o un admin podría borrar agentes de otra oficina.

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
    const { type, invitation_id, user_id, auth_id } = await req.json()

    if (type !== 'invitation' && type !== 'user') {
      return json({ error: "type debe ser 'invitation' o 'user'" }, 400)
    }

    // ── Auth: quien llama tiene que ser admin ────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const sbCaller = createClient(
      Deno.env.get('SUPABASE_URL')      ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await sbCaller.auth.getUser()
    if (!caller) return json({ error: 'No autorizado' }, 401)

    const { data: profile } = await sbCaller
      .from('users').select('role, tenant_id').eq('auth_id', caller.id).single()
    if (!profile || profile.role !== 'admin') {
      return json({ error: 'Solo los administradores pueden eliminar' }, 403)
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Invitación ───────────────────────────────────────────────────────────
    if (type === 'invitation') {
      if (!invitation_id) return json({ error: 'invitation_id es requerido' }, 400)

      const { data: inv } = await sbAdmin
        .from('invitations').select('id, tenant_id').eq('id', invitation_id).single()
      if (!inv) return json({ error: 'La invitación no existe' }, 404)
      if (inv.tenant_id !== profile.tenant_id) {
        return json({ error: 'Esa invitación es de otra oficina' }, 403)
      }

      const { error } = await sbAdmin.from('invitations').delete().eq('id', invitation_id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    // ── Agente ───────────────────────────────────────────────────────────────
    if (!user_id) return json({ error: 'user_id es requerido' }, 400)

    const { data: target } = await sbAdmin
      .from('users').select('id, tenant_id, auth_id, name, email').eq('id', user_id).single()
    if (!target) return json({ error: 'El agente no existe' }, 404)
    if (target.tenant_id !== profile.tenant_id) {
      return json({ error: 'Ese agente es de otra oficina' }, 403)
    }
    // Sin esto un admin puede borrarse a sí mismo y dejar la oficina sin acceso.
    if (target.auth_id && target.auth_id === caller.id) {
      return json({ error: 'No podés eliminar tu propia cuenta' }, 400)
    }

    // ── Bitácora + soltar las fichas ─────────────────────────────────────────
    //
    // Sin esto, contactos y empresas se quedaban con un `created_by` apuntando
    // a un uuid que ya no existe: parecían tener dueño y en realidad no lo
    // tenía nadie. Se anota quién creó qué —el dato de auditoría tiene que
    // sobrevivir al agente— y recién después se sueltan.
    //
    // Las propiedades solo se anotan: `properties.agent_id` es ON DELETE SET
    // NULL, así que la base las suelta sola al borrar la fila de `users`.
    const label: Record<string, string> = {
      crm_contacts: 'name', crm_companies: 'name', properties: 'title',
    }
    const bitacora: Record<string, unknown>[] = []

    for (const entidad of ['crm_contacts', 'crm_companies', 'properties']) {
      const col = entidad === 'properties' ? 'agent_id' : 'created_by'
      const val = entidad === 'properties' ? target.id : target.auth_id
      if (!val) continue

      const { data: filas } = await sbAdmin
        .from(entidad).select(`id, ${label[entidad]}`).eq(col, val)

      for (const f of filas ?? []) {
        bitacora.push({
          tenant_id:      target.tenant_id,
          agent_auth_id:  target.auth_id,
          agent_users_id: target.id,
          agent_name:     target.name,
          agent_email:    target.email,
          entidad,
          registro_id:    f.id,
          registro_label: (f as Record<string, string>)[label[entidad]],
          archivado_por:  caller.id,
        })
      }
    }

    if (bitacora.length) {
      const { error: logErr } = await sbAdmin.from('agent_offboarding_log').insert(bitacora)
      // Si la bitácora falla no se borra nada: perder el rastro de auditoría
      // es peor que dejar al agente un rato más.
      if (logErr) return json({ error: `No se pudo registrar la bitácora: ${logErr.message}` }, 400)
    }

    if (target.auth_id) {
      for (const entidad of ['crm_contacts', 'crm_companies']) {
        await sbAdmin.from(entidad).update({ created_by: null }).eq('created_by', target.auth_id)
      }
    }

    const { error: delErr } = await sbAdmin.from('users').delete().eq('id', user_id)
    if (delErr) return json({ error: delErr.message }, 400)

    // El perfil ya no está; si la cuenta de auth falla, se reporta pero no se
    // revierte: queda un auth hueco, que es preferible a un perfil fantasma.
    const targetAuthId = target.auth_id ?? auth_id
    if (targetAuthId) {
      const { error: authErr } = await sbAdmin.auth.admin.deleteUser(targetAuthId)
      if (authErr) {
        return json({ ok: true, liberadas: bitacora.length, warning: `Perfil eliminado, pero la cuenta de acceso no: ${authErr.message}` })
      }
    }

    return json({ ok: true, liberadas: bitacora.length })

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500)
  }
})
