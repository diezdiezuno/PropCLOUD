-- ══════════════════════════════════════════════════════════════
-- RLS de properties: el agente ve todas las de su tenant pero solo
-- edita las suyas (agent_id = su users.id); el admin edita todas.
--
-- Las policies permisivas se combinan con OR, así que para que la
-- restricción de UPDATE realmente restrinja hay que eliminar cualquier
-- policy amplia de escritura que exista. Este script reconstruye el set
-- completo, así que es idempotente y no depende de nombres previos.
--
-- service_role ignora RLS por completo → backend, migraciones y feeds no
-- se ven afectados. La lectura pública (anon) se recrea acá mismo.
-- ══════════════════════════════════════════════════════════════

-- ── Helpers (security definer para no chocar con la RLS de las tablas
--    que consultan) ─────────────────────────────────────────────────
create or replace function is_tenant_admin(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_admins where user_id = auth.uid() and tenant_id = tid
  )
$$;

-- users.id del usuario actual dentro del tenant (agent_id lo referencia).
create or replace function my_users_id(tid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from users where auth_id = auth.uid() and tenant_id = tid limit 1
$$;

-- ── Reconstruir policies de properties ────────────────────────────
alter table properties enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'properties'
  loop
    execute format('drop policy %I on properties', pol.policyname);
  end loop;
end $$;

-- SELECT anon: solo propiedades publicadas (sitio público)
create policy "public read active" on properties
  for select to anon
  using (status = 'active');

-- SELECT autenticado: los miembros del tenant ven todas las suyas
create policy "member read" on properties
  for select to authenticated
  using (is_tenant_member(tenant_id));

-- INSERT: cualquier miembro del tenant (el agente se autoasigna; el admin asigna)
create policy "member insert" on properties
  for insert to authenticated
  with check (is_tenant_member(tenant_id));

-- UPDATE: admin cualquiera del tenant; agente solo las suyas.
-- with_check con el mismo criterio ⇒ un agente no puede reasignar una
-- propiedad a otro (dejaría de ser suya); el admin sí (pasa por la rama admin).
create policy "admin or owner update" on properties
  for update to authenticated
  using      (is_tenant_admin(tenant_id) or agent_id = my_users_id(tenant_id))
  with check (is_tenant_admin(tenant_id) or agent_id = my_users_id(tenant_id));

-- DELETE: mismo criterio (la app archiva vía update, pero se cubre por las dudas)
create policy "admin or owner delete" on properties
  for delete to authenticated
  using (is_tenant_admin(tenant_id) or agent_id = my_users_id(tenant_id));
