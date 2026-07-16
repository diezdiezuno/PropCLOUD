-- ══════════════════════════════════════════════════════════════
-- Contratos de captación (tab Contrato de la propiedad).
--
-- Alimenta también "Contratos por vencer" en Próximos eventos del
-- dashboard: end_date dentro de la ventana + status vigente + active.
--
-- Reemplaza conceptualmente a properties.mandate_type, que queda sin
-- uso (no se borra por si hay datos que consultar).
-- ══════════════════════════════════════════════════════════════

create table if not exists contracts (
  id          uuid default gen_random_uuid() primary key,
  tenant_id   uuid references tenants(id)      on delete cascade not null,
  property_id uuid references properties(id)   on delete cascade not null,
  contact_id  uuid references crm_contacts(id) on delete set null,
  kind        text,                    -- exclusiva | abierta | alquiler | venta
  start_date  date,
  end_date    date,
  price       numeric,
  currency    text default 'USD',
  commission  numeric,                 -- porcentaje
  status      text not null default 'vigente'
              check (status in ('vigente', 'vencido', 'renovado', 'cancelado')),
  notes       text,
  doc_url     text,                    -- PDF firmado
  active      boolean not null default true,   -- soft-delete, igual que el resto
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists contracts_property_idx on contracts (property_id);
create index if not exists contracts_vencen_idx   on contracts (tenant_id, end_date)
  where status = 'vigente' and active;

alter table contracts enable row level security;
drop policy if exists "tenant member" on contracts;
create policy "tenant member" on contracts
  for all to authenticated
  using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
