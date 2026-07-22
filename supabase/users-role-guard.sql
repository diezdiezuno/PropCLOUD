-- ══════════════════════════════════════════════════════════════
-- `users.role` era autoasignable y `tenant_admins` no se llenaba solo.
--
-- Dos problemas que se alimentan entre sí:
--
-- 1. La policy de UPDATE de `users` deja a cada quien editar su propia
--    fila —que es lo que necesita el perfil— pero sin distinguir qué
--    columna. Verificado con una sesión real: un agente se puso
--    `role = 'admin'` y le quedó. La UI mira ese campo, así que se abre
--    el panel de admin entero, y `invite-agent` autoriza con él, así que
--    también podía invitar gente al tenant.
--
-- 2. Nada en la app escribe en `tenant_admins`; solo el panel de
--    superadmin. Como la RLS se apoya en esa tabla, todo admin creado
--    desde la app nacía con la UI de admin y los permisos de agente:
--    botones que al guardar no hacen nada. Le pasó a dos personas.
--
-- Se arregla con dos triggers: uno blinda las columnas sensibles, el
-- otro mantiene `tenant_admins` igual a `users.role`. Así `role` vuelve
-- a ser confiable y deja de existir el desfase.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Columnas que solo un admin puede mover ─────────────────────
--
-- Revierte en silencio en vez de fallar: el formulario de perfil manda
-- la fila entera, y un error rompería el guardado legítimo del nombre.
-- `tenant_id` y `auth_id` van en la misma bolsa porque cambiarlos es
-- mudarse de oficina o apropiarse de otra cuenta.
create or replace function users_protege_campos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_tenant_admin(old.tenant_id) then
    return new;
  end if;
  new.role      := old.role;
  new.tenant_id := old.tenant_id;
  new.auth_id   := old.auth_id;
  return new;
end $$;

drop trigger if exists users_protege_campos_trg on users;
create trigger users_protege_campos_trg
  before update on users
  for each row execute function users_protege_campos();

-- ── 2. `tenant_admins` sigue a `users.role` ───────────────────────
--
-- Una sola fuente de verdad. El admin asciende a alguien desde la UI
-- como siempre y la tabla que mira la RLS se actualiza sola.
create or replace function users_sync_tenant_admins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.auth_id is null then
    return new;
  end if;
  if new.role = 'admin' then
    insert into tenant_admins (user_id, tenant_id, role)
    values (new.auth_id, new.tenant_id, 'admin')
    on conflict do nothing;
  else
    delete from tenant_admins
     where user_id = new.auth_id and tenant_id = new.tenant_id;
  end if;
  return new;
end $$;

drop trigger if exists users_sync_tenant_admins_trg on users;
create trigger users_sync_tenant_admins_trg
  after insert or update of role, auth_id, tenant_id on users
  for each row execute function users_sync_tenant_admins();

-- Alinear lo que ya existe.
insert into tenant_admins (user_id, tenant_id, role)
select u.auth_id, u.tenant_id, 'admin'
  from users u
 where u.role = 'admin' and u.auth_id is not null
on conflict do nothing;

-- Ojo con el orden: el trigger 1 usa `is_tenant_admin`, que lee
-- `tenant_admins`. Si esa tabla quedara vacía, nadie podría ascender a
-- nadie y haría falta entrar por el panel de superadmin.
