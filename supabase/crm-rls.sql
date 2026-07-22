-- ══════════════════════════════════════════════════════════════
-- RLS de crm_contacts y crm_companies: el agente ve todo lo de su
-- oficina pero solo edita y archiva lo suyo; el admin, todo.
--
-- Mismo criterio que properties, con dos diferencias que importan:
--
-- 1. Acá el dueño se guarda en `created_by`, que contiene el auth.uid()
--    —no el users.id, como hace properties.agent_id—. Se respeta la
--    convención de cada tabla en vez de unificarlas, porque migrar
--    created_by implicaría reescribir filas y tocar el código que ya
--    lo escribe así.
--
-- 2. Los contactos suman una segunda vía: figurar en crm_contact_agents,
--    que es la lista visible de "agentes asignados". Las empresas no
--    tienen esa tabla, así que para ellas solo cuenta created_by.
--
-- Las policies permisivas se combinan con OR: para que una restricción
-- de UPDATE restrinja de verdad hay que borrar cualquier policy amplia
-- de escritura. Este script reconstruye el set completo, así que es
-- idempotente y no depende de los nombres que hubiera antes.
--
-- service_role ignora RLS → backend y migraciones no se ven afectados.
-- ══════════════════════════════════════════════════════════════

-- Helper compartido con properties-rls.sql. Se recrea por si este
-- script se corre primero.
create or replace function is_tenant_admin(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_admins where user_id = auth.uid() and tenant_id = tid
  )
$$;

-- Pertenencia al tenant, como admin o como agente.
create or replace function is_tenant_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenant_admins where user_id = auth.uid() and tenant_id = tid)
      or exists (select 1 from users         where auth_id = auth.uid() and tenant_id = tid)
$$;

-- ¿Estoy en la lista de agentes asignados de este contacto?
--
-- Los contactos tienen dos nociones de dueño: `created_by`, que es quien lo
-- dio de alta, y `crm_contact_agents`, que es la lista visible de "agentes
-- asignados" y la que el equipo entiende como propiedad. Si la RLS mirara
-- solo created_by, reasignar un contacto desde la ficha no daría acceso al
-- nuevo agente y el botón fallaría sin explicación.
create or replace function soy_agente_del_contacto(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from crm_contact_agents ca
      join users u on u.id = ca.user_id
     where ca.contact_id = cid
       and u.auth_id = auth.uid()
  )
$$;


-- ── Reconstruir policies ──────────────────────────────────────────
do $$
declare
  t     text;
  pol   record;
  duenio text;
begin
  foreach t in array array['crm_contacts', 'crm_companies'] loop

    -- Contactos: dueño = quien lo creó, o quien figura como agente asignado.
    -- Empresas: solo quien la creó — no tienen tabla de agentes.
    duenio := case t
      when 'crm_contacts' then '(created_by = auth.uid() or soy_agente_del_contacto(id))'
      else '(created_by = auth.uid())'
    end;

    execute format('alter table %I enable row level security', t);

    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;

    -- Lectura: todo el equipo ve la cartera de la oficina.
    execute format($f$
      create policy "Miembros leen" on %I
        for select to authenticated
        using (is_tenant_member(tenant_id))
    $f$, t);

    -- Alta: cualquier miembro. El agente solo puede crear a su nombre;
    -- el admin puede crear ya asignado a otra persona.
    execute format($f$
      create policy "Miembros crean" on %I
        for insert to authenticated
        with check (
          is_tenant_member(tenant_id)
          and (is_tenant_admin(tenant_id) or created_by = auth.uid())
        )
    $f$, t);

    -- Edición: admin, o el dueño sobre lo suyo.
    --
    -- El WITH CHECK impide que un agente se saque de encima un registro
    -- reasignándolo: sin él podría editar created_by, perder el acceso o
    -- pasárselo a otro. Reasignar queda solo para el admin.
    --
    -- Las filas viejas con created_by nulo y sin agente asignado quedan solo
    -- para el admin: no hay forma de saber de quién eran, y dárselas a
    -- cualquiera sería peor que pedir que un admin las asigne.
    execute format($f$
      create policy "Admin o dueño editan" on %I
        for update to authenticated
        using      (is_tenant_admin(tenant_id) or %s)
        with check (is_tenant_admin(tenant_id) or %s)
    $f$, t, duenio, duenio);

    -- Borrado físico: solo admin. Los agentes archivan (active = false),
    -- que pasa por la policy de UPDATE.
    execute format($f$
      create policy "Admin borra" on %I
        for delete to authenticated
        using (is_tenant_admin(tenant_id))
    $f$, t);

  end loop;
end $$;
