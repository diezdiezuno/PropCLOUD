-- ══════════════════════════════════════════════════════════════
-- PropTools → PropCLOUD: migración completa de esquema.
-- Herramientas: firmas, tarjetas, rótulos, valoraciones,
--               calendario, equipos (+ perfil, registro, admin).
-- Usuarios de PropTools = agentes de PropCLOUD (tabla users).
-- Ejecutar en la base de PropCLOUD.
-- ══════════════════════════════════════════════════════════════

-- ── Usuarios (agentes) — modelo PropTools tal cual ─────────────
create table if not exists users (
  id         uuid default gen_random_uuid() primary key,
  auth_id    uuid unique not null,
  tenant_id  uuid references tenants(id) on delete cascade not null,
  name       text,
  email      text,
  role       text not null default 'agent',
  job_title  text,
  phone      text,
  whatsapp   text,
  instagram  text,
  facebook   text,
  linkedin   text,
  tiktok     text,
  photo_url  text,
  created_at timestamptz default now()
);

create table if not exists invitations (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid references tenants(id) on delete cascade not null,
  email      text not null,
  name       text,
  job_title  text,
  token      text unique not null default encode(gen_random_bytes(24), 'hex'),
  status     text default 'pending',
  invited_by uuid,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ── Helper: ¿es el usuario actual miembro del tenant? ──────────
-- (admin en tenant_admins O agente en users). security definer para
-- no chocar con la RLS de users.
create or replace function is_tenant_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenant_admins where user_id = auth.uid() and tenant_id = tid)
      or exists (select 1 from users where auth_id = auth.uid() and tenant_id = tid)
$$;

-- Tenant del usuario actual (para defaults en tablas sin tenant_id explícito)
create or replace function my_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select tenant_id from tenant_admins where user_id = auth.uid() limit 1),
    (select tenant_id from users where auth_id = auth.uid() limit 1)
  )
$$;

alter table users enable row level security;
create policy "member read"  on users for select to authenticated using (is_tenant_member(tenant_id));
create policy "self insert"  on users for insert to authenticated with check (auth_id = auth.uid());
create policy "self update"  on users for update to authenticated using (auth_id = auth.uid());
create policy "admin manage" on users for all to authenticated
  using (tenant_id in (select tenant_id from tenant_admins where user_id = auth.uid()))
  with check (tenant_id in (select tenant_id from tenant_admins where user_id = auth.uid()));

alter table invitations enable row level security;
-- el registro lee la invitación por token ANTES de tener sesión
create policy "token lookup" on invitations for select to anon, authenticated using (true);
create policy "used delete"  on invitations for delete to authenticated using (true);
create policy "admin manage" on invitations for all to authenticated
  using (tenant_id in (select tenant_id from tenant_admins where user_id = auth.uid()))
  with check (tenant_id in (select tenant_id from tenant_admins where user_id = auth.uid()));

-- ── Firmas ──────────────────────────────────────────────────────
create table if not exists tenant_templates (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid references tenants(id) on delete cascade not null,
  name       text,
  html       text,
  config     jsonb,
  active     boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists signatures (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid references tenants(id) on delete cascade not null,
  user_id    uuid references users(id) on delete cascade not null,
  save_name  text not null,
  template   text,
  photo_url  text,
  name text, role text, email text, phone text, whatsapp text,
  facebook text, instagram text, linkedin text, tiktok text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Tarjetas y Rótulos ──────────────────────────────────────────
create table if not exists tarjetas (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid references tenants(id) on delete cascade not null default my_tenant_id(),
  user_id    uuid references users(id) on delete cascade not null,
  save_name  text,
  template   text,
  photo_url  text,
  name       text,
  whatsapp   text,
  email      text,
  instagram  text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists rotulos (
  id          uuid default gen_random_uuid() primary key,
  tenant_id   uuid references tenants(id) on delete cascade not null default my_tenant_id(),
  user_id     uuid references users(id) on delete cascade not null,
  save_name   text,
  orientacion text,
  template    text,
  texto_rojo  text,
  name        text,
  whatsapp    text,
  email       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Valoraciones (avalúos) ──────────────────────────────────────
create table if not exists avaluos (
  id                       uuid default gen_random_uuid() primary key,
  tenant_id                uuid references tenants(id) on delete cascade not null,
  user_id                  uuid not null,           -- auth uid del agente
  referencia               text,
  obra                     text,
  fecha_avaluo             date,
  provincia                text,
  canton                   text,
  distrito                 text,
  ubicacion                text,
  notas                    text,
  tipo_principal           text,
  tipo_segunda             text,
  area_construccion        numeric default 0,
  anios_construccion       numeric default 0,
  pct_remodelacion         numeric default 0,
  anios_remodelacion       numeric default 0,
  vida_util                numeric default 90,
  estado_conservacion      numeric default 0,
  area_lote                numeric default 0,
  val_mt2_lote             numeric default 0,
  anio_mapa                int,
  tipo_cambio              numeric,
  complementarias          jsonb,
  resultado_terreno_col    numeric default 0,
  resultado_const_base_col numeric default 0,
  resultado_const_depr_col numeric default 0,
  resultado_compl_col      numeric default 0,
  resultado_total_col      numeric default 0,
  resultado_total_usd      numeric default 0,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- ── Calendario ──────────────────────────────────────────────────
create table if not exists calendarios (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid references tenants(id) on delete cascade not null default my_tenant_id(),
  nombre     text not null,
  color      text,
  created_at timestamptz default now()
);

create table if not exists eventos_calendario (
  id            uuid default gen_random_uuid() primary key,
  tenant_id     uuid references tenants(id) on delete cascade not null default my_tenant_id(),
  calendario_id uuid references calendarios(id) on delete set null,
  titulo        text not null,
  fecha         date not null,
  hora_inicio   text,
  hora_fin      text,
  descripcion   text,
  todo_dia      boolean default false,
  user_auth_id  uuid,
  creado_por    uuid,
  created_at    timestamptz default now()
);

-- ── Equipos y reservas ──────────────────────────────────────────
create table if not exists equipos (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid references tenants(id) on delete cascade not null default my_tenant_id(),
  nombre     text not null,
  tipo       text,
  marca      text,
  modelo     text,
  estado     text default 'disponible',
  created_at timestamptz default now()
);

create table if not exists reservas (
  id           uuid default gen_random_uuid() primary key,
  tenant_id    uuid references tenants(id) on delete cascade not null default my_tenant_id(),
  user_auth_id uuid not null,
  fecha_inicio date not null,
  fecha_fin    date not null,
  motivo       text,
  estado       text default 'activa',
  created_at   timestamptz default now()
);

create table if not exists reserva_equipos (
  id         uuid default gen_random_uuid() primary key,
  reserva_id uuid references reservas(id) on delete cascade not null,
  equipo_id  uuid references equipos(id) on delete cascade not null
);

-- ── RLS de herramientas: acceso por membresía del tenant ────────
do $$
declare t text;
begin
  foreach t in array array['tenant_templates','signatures','tarjetas','rotulos','avaluos','calendarios','eventos_calendario','equipos','reservas']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "tenant member" on %I for all to authenticated using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id))', t);
  end loop;
end $$;

alter table reserva_equipos enable row level security;
create policy "via reserva" on reserva_equipos for all to authenticated
  using (exists (select 1 from reservas r where r.id = reserva_id and is_tenant_member(r.tenant_id)))
  with check (exists (select 1 from reservas r where r.id = reserva_id and is_tenant_member(r.tenant_id)));

-- ── CRM: dar acceso a agentes (además de admins) ────────────────
-- Las policies existentes usan tenant_admins; estas son ADITIVAS.
do $$
declare t text;
begin
  foreach t in array array['crm_contacts','crm_companies','crm_contact_companies','crm_contact_types','contact_types','contact_sources','properties']
  loop
    begin
      execute format('create policy "agent member access" on %I for all to authenticated using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id))', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- property_types es de solo lectura para agentes
do $$ begin
  create policy "agent read" on property_types for select to authenticated using (is_tenant_member(tenant_id));
exception when duplicate_object then null; end $$;
