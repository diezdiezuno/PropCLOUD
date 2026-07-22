-- ══════════════════════════════════════════════════════════════
-- RLS de las tablas puente de contactos.
--
-- Sin esto, `crm-rls.sql` no alcanza: la policy de UPDATE de
-- crm_contacts deja editar a quien figure en crm_contact_agents, y
-- esa tabla estaba abierta. O sea, cualquier agente podía insertarse
-- como agente de un contacto ajeno y con eso ganar permiso de
-- editarlo. Verificado con una sesión real: el insert pasaba y el
-- delete borraba las asignaciones de otro.
--
-- Regla única: podés escribir los vínculos de un contacto si podés
-- escribir el contacto. Una sola noción de dueño, sin una segunda
-- lista de permisos que se desincronice.
-- ══════════════════════════════════════════════════════════════

-- ¿Puedo editar este contacto? Es la policy de UPDATE de crm_contacts
-- convertida en función, para que las puente no la repitan y no se
-- desalineen cuando una de las dos cambie.
create or replace function puedo_editar_contacto(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_contacts c
     where c.id = cid
       and (is_tenant_admin(c.tenant_id)
            or c.created_by = auth.uid()
            or soy_agente_del_contacto(c.id))
  )
$$;

do $$
declare
  t   text;
  pol record;
begin
  foreach t in array array['crm_contact_agents', 'crm_contact_companies', 'crm_contact_types'] loop

    execute format('alter table %I enable row level security', t);

    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;

    -- Lectura: todo el equipo. La ficha muestra a qué agente y a qué
    -- empresa pertenece cada contacto, y esa vista es compartida.
    execute format($f$
      create policy "Miembros leen" on %I
        for select to authenticated
        using (is_tenant_member(tenant_id))
    $f$, t);

    -- Escritura: solo sobre contactos que ya puedo editar.
    --
    -- El formulario guarda los vínculos con delete + insert, así que
    -- hacen falta las tres. Sin la de delete, un agente le borraba los
    -- agentes asignados a un contacto ajeno.
    execute format($f$
      create policy "Escribe quien edita el contacto" on %I
        for insert to authenticated
        with check (is_tenant_member(tenant_id) and puedo_editar_contacto(contact_id))
    $f$, t);

    execute format($f$
      create policy "Edita quien edita el contacto" on %I
        for update to authenticated
        using      (puedo_editar_contacto(contact_id))
        with check (puedo_editar_contacto(contact_id))
    $f$, t);

    execute format($f$
      create policy "Borra quien edita el contacto" on %I
        for delete to authenticated
        using (puedo_editar_contacto(contact_id))
    $f$, t);

  end loop;
end $$;

-- Queda un margen aceptado a propósito: un agente ya asignado puede
-- sacarse a sí mismo o a otro de la lista. Cerrarlo pide reservar
-- crm_contact_agents al admin, y eso rompe el formulario, que reescribe
-- la lista entera en cada guardado. La escalada —entrar desde afuera—
-- sí está cerrada, que es la que importa.
