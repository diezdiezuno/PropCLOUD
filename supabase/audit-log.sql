-- ══════════════════════════════════════════════════════════════
-- Auditoría: quién cambió qué, en la base y no en la app.
--
-- Va con triggers a propósito. `crm_contacts` se escribe hoy desde cinco
-- archivos distintos, y además desde edge functions, scripts y el editor
-- SQL. Instrumentar el código significa acordarse de todos los lugares
-- —los de hoy y los que se agreguen— y aun así no cubre lo que no pasa
-- por la app. Un trigger no se puede esquivar: corre incluso para el
-- service role, que se saltea la RLS entera.
--
-- Lo que esto NO ve: las lecturas. Ningún trigger sabe quién consultó una
-- ficha; eso solo se puede desde la app, pantalla por pantalla, y genera
-- mucho más volumen que las escrituras. Es otra decisión.
-- ══════════════════════════════════════════════════════════════

create table if not exists audit_log (
  id          bigserial primary key,
  tenant_id   uuid,
  tabla       text not null,
  operacion   text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id text,

  -- Nombre al momento del cambio. Se copia para poder leer el registro sin
  -- salir a buscar una fila que quizá ya se borró.
  etiqueta    text,

  -- UPDATE: solo lo que cambió, {campo: {antes, despues}}. INSERT y DELETE:
  -- la fila entera. Guardar old y new completos en cada edición duplica
  -- todo y vuelve el log ilegible.
  cambios     jsonb,

  -- Dos identidades, no una: cuando actúa el service role `auth.uid()`
  -- viene nulo, y sin el rol un cambio de una migración es indistinguible
  -- de uno hecho por nadie.
  actor_id    uuid,
  actor_rol   text,

  creado_en   timestamptz not null default now()
);

create index if not exists audit_log_tenant_idx   on audit_log (tenant_id, creado_en desc);
create index if not exists audit_log_registro_idx on audit_log (tabla, registro_id);
create index if not exists audit_log_actor_idx    on audit_log (actor_id, creado_en desc);

-- ── El trigger ────────────────────────────────────────────────────
create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  viejo   jsonb := case when TG_OP = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  nuevo   jsonb := case when TG_OP = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  fila    jsonb := case when TG_OP = 'DELETE' then viejo else nuevo end;
  cambios jsonb := '{}'::jsonb;
  k       text;
  tid     uuid;
begin
  if TG_OP = 'UPDATE' then
    for k in select jsonb_object_keys(nuevo) loop
      if nuevo -> k is distinct from viejo -> k then
        cambios := cambios || jsonb_build_object(k, jsonb_build_object('antes', viejo -> k, 'despues', nuevo -> k));
      end if;
    end loop;
    -- Los formularios guardan la fila entera aunque no se haya tocado nada.
    -- Sin esto el log se llena de updates que no cambiaron nada.
    if cambios = '{}'::jsonb then
      return null;
    end if;
  else
    cambios := fila;
  end if;

  -- `tenants` es la excepción: su propio id es el tenant. No se usa un
  -- coalesce genérico porque una fila con tenant_id nulo caería en su id y
  -- quedaría marcada con un tenant que no es —y la RLS de abajo filtra por
  -- ese campo, así que el error se convertiría en una fuga.
  tid := case TG_TABLE_NAME
           when 'tenants' then (fila ->> 'id')::uuid
           else nullif(fila ->> 'tenant_id', '')::uuid
         end;

  insert into audit_log (tenant_id, tabla, operacion, registro_id, etiqueta, cambios, actor_id, actor_rol)
  values (
    tid,
    TG_TABLE_NAME,
    TG_OP,
    coalesce(fila ->> 'id', fila ->> 'tenant_id'),
    coalesce(fila ->> 'name', fila ->> 'title', fila ->> 'email', fila ->> 'slug'),
    cambios,
    auth.uid(),
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', current_user)
  );

  return null;   -- AFTER trigger: el valor de retorno se ignora
end $$;

-- ── Colgarlo de las tablas que importan ───────────────────────────
--
-- Fuera quedan analíticas, vistas de página y leads entrantes: son ruido de
-- máquina, no actos de personas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'crm_contacts', 'crm_companies', 'crm_contact_agents',   -- la cartera y a quién está asignada
    'properties',
    'users', 'tenant_admins', 'invitations',                 -- permisos: quién ascendió o dejó entrar a quién
    'tenant_config', 'tenants'                               -- qué se cambió del sitio público
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'audit: % no existe, se omite', t;
      continue;
    end if;
    execute format('drop trigger if exists audit_trg on %I', t);
    execute format(
      'create trigger audit_trg after insert or update or delete on %I
         for each row execute function audit_trigger()', t);
  end loop;
end $$;

-- ── Acceso ────────────────────────────────────────────────────────
alter table audit_log enable row level security;

-- Solo lectura y solo para admins de la oficina. No hay policy de insert,
-- update ni delete a propósito: un registro de auditoría que el auditado
-- puede editar no sirve para nada. Lo escribe el trigger, que es security
-- definer y por eso se saltea esta RLS.
drop policy if exists "Admins leen la auditoría" on audit_log;
create policy "Admins leen la auditoría" on audit_log
  for select to authenticated
  using (is_tenant_admin(tenant_id));

-- Cuando la tabla pese, la respuesta es borrar por fecha, no dejar de
-- auditar:  delete from audit_log where creado_en < now() - interval '2 years';
