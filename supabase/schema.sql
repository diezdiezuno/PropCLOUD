-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── TENANTS ────────────────────────────────────────────────────────────────

create table tenants (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  name        text not null,
  domain      text unique not null,
  logo_url    text,
  theme       jsonb not null default '{
    "primaryColor": "#6b2fa0",
    "accentColor": "#f59e0b",
    "fontHeading": "Playfair Display",
    "fontBody": "Outfit",
    "mapStyle": "mapbox://styles/mapbox/streets-v12"
  }'::jsonb,
  created_at  timestamptz not null default now()
);

-- ─── TENANT CONFIG ──────────────────────────────────────────────────────────

create table tenant_config (
  tenant_id      uuid primary key references tenants(id) on delete cascade,
  hero_title     text,
  hero_subtitle  text,
  about_html     text,
  whatsapp       text,
  contact_email  text,
  address        text,
  instagram      text,
  facebook       text,
  linkedin       text
);

-- ─── PROPERTY SOURCES ───────────────────────────────────────────────────────

create table property_sources (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  type        text not null check (type in ('remax_cca', 'manual', 'custom_api')),
  config      jsonb not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── AGENTS ─────────────────────────────────────────────────────────────────

create table agents (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  whatsapp    text,
  photo_url   text,
  bio         text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── PROPERTIES (manual entries only) ───────────────────────────────────────

create table properties (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  external_id  text,
  source       text not null default 'manual' check (source in ('remax_cca', 'manual', 'custom_api')),
  type         text not null default 'Residential',
  transaction  text not null default 'sale' check (transaction in ('sale', 'rent')),
  title        text not null,
  description  text,
  price        numeric not null default 0,
  currency     text not null default 'USD' check (currency in ('USD', 'CRC')),
  bedrooms     int,
  bathrooms    int,
  area_m2      numeric,
  address      text,
  city         text,
  country      text,
  lat          numeric,
  lng          numeric,
  images       text[] not null default '{}',
  status       text not null default 'active' check (status in ('active', 'inactive', 'sold')),
  agent_name   text,
  agent_phone  text,
  agent_email  text,
  created_at   timestamptz not null default now()
);

-- ─── LEADS ──────────────────────────────────────────────────────────────────

create table leads (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  property_id  text,
  name         text not null,
  email        text,
  phone        text,
  message      text,
  source       text,
  created_at   timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────

alter table tenants          enable row level security;
alter table tenant_config    enable row level security;
alter table property_sources enable row level security;
alter table agents           enable row level security;
alter table properties       enable row level security;
alter table leads            enable row level security;

-- Public read for tenant data (needed for SSR without auth)
create policy "Public read tenants"
  on tenants for select using (true);

create policy "Public read tenant_config"
  on tenant_config for select using (true);

create policy "Public read property_sources"
  on property_sources for select using (is_active = true);

create policy "Public read agents"
  on agents for select using (is_active = true);

create policy "Public read properties"
  on properties for select using (status = 'active');

-- Leads: anyone can insert, only service role reads
create policy "Anyone can submit lead"
  on leads for insert with check (true);

-- ─── SEED: Sunrise CR ────────────────────────────────────────────────────────

insert into tenants (slug, name, domain, logo_url, theme) values (
  'sunrise',
  'Sunrise CR',
  'sunrisecr.com',
  'https://res.cloudinary.com/dlgrhr6lh/image/upload/v1778374987/sunrise_logo_eg8qkr.png',
  '{
    "primaryColor": "#6b2fa0",
    "accentColor": "#f59e0b",
    "fontHeading": "Playfair Display",
    "fontBody": "Outfit",
    "mapStyle": "mapbox://styles/ssolorzano/cmp04iyh7000t01rw07qhd7eh"
  }'
);

insert into tenant_config (tenant_id, hero_title, hero_subtitle, whatsapp, contact_email)
select id, 'Encontrá tu propiedad ideal en Costa Rica', 'Expertos en bienes raíces desde 2010', '+50688888888', 'info@sunrisecr.com'
from tenants where slug = 'sunrise';

insert into property_sources (tenant_id, type, config)
select id, 'remax_cca', '{"officeId": "4E4F611D-B908-45DC-8A11-C0A00E600AC9"}'
from tenants where slug = 'sunrise';
