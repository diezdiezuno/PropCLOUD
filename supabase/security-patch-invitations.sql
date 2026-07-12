-- Parche de seguridad — invitaciones.
-- Corregir 2 hallazgos de la revisión:
--   • cualquier anónimo podía leer TODAS las invitaciones (email + token)
--   • cualquier autenticado podía borrar invitaciones de otro tenant
-- Correr una vez en el SQL editor de PropCLOUD.

-- ── 1. Quitar el select abierto a anon ─────────────────────────
drop policy if exists "token lookup" on invitations;

-- Lookup por token vía RPC security definer: devuelve SOLO la fila
-- cuyo token coincide exactamente (no permite enumerar las demás).
create or replace function get_invitation(p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',         i.id,
    'email',      i.email,
    'name',       i.name,
    'job_title',  i.job_title,
    'tenant_id',  i.tenant_id,
    'status',     i.status,
    'expires_at', i.expires_at,
    'invited_by', i.invited_by,
    'tenant_name', t.name
  )
  from invitations i
  join tenants t on t.id = i.tenant_id
  where i.token = p_token
  limit 1;
$$;

grant execute on function get_invitation(text) to anon, authenticated;

-- ── 2. Borrado solo dentro del propio tenant ───────────────────
drop policy if exists "used delete" on invitations;
create policy "member delete" on invitations for delete to authenticated
  using (is_tenant_member(tenant_id));
