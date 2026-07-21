-- Vincular el admin de Noduus con su usuario migrado de PropTools.
-- Reemplazá los dos emails y corré todo en el SQL editor.
--
-- ADMIN_EMAIL    = diezdiezuno.dev@gmail.com
-- PROPTOOLS_EMAIL = sergio.solorzano@remaxcentralcr.com
-- (si son el mismo email, poné el mismo en ambos)

do $$
declare
  admin_auth   uuid;  -- auth id del login de Noduus
  old_auth     uuid;  -- auth id que la migración le puso al usuario migrado
  migrated_uid uuid;  -- users.id migrado (dueño de rótulos/tarjetas/firmas)
begin
  select id into admin_auth from auth.users where email = 'diezdiezuno.dev@gmail.com';
  if admin_auth is null then raise exception 'No existe auth user diezdiezuno.dev@gmail.com'; end if;

  select id, auth_id into migrated_uid, old_auth
  from users where lower(email) = lower('sergio.solorzano@remaxcentralcr.com')
  order by created_at limit 1;
  if migrated_uid is null then raise exception 'No hay usuario migrado con sergio.solorzano@remaxcentralcr.com'; end if;

  -- 1. quitar la fila auto-provisionada (vacía) del admin, si existe
  delete from users where auth_id = admin_auth and id <> migrated_uid;

  -- 2. apuntar el usuario migrado al login del admin
  update users set auth_id = admin_auth where id = migrated_uid;

  -- 3. remapear las tablas que guardan auth ids (no users.id)
  if old_auth is not null and old_auth <> admin_auth then
    update avaluos            set user_id      = admin_auth where user_id      = old_auth;
    update eventos_calendario set user_auth_id = admin_auth where user_auth_id = old_auth;
    update eventos_calendario set creado_por   = admin_auth where creado_por   = old_auth;
    update reservas           set user_auth_id = admin_auth where user_auth_id = old_auth;
  end if;

  raise notice 'Listo: users % → auth %', migrated_uid, admin_auth;
end $$;
