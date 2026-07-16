-- ══════════════════════════════════════════════════════════════
-- Dueños de propiedad: de JSON serializado a tabla real.
--
-- Antes: properties.features->>'owners' guardaba un JSON string con
-- [{type,id,name,subtitle}], y las consultas hacían
--   ilike('features->>owners', '%"type":"contact","id":"..."%')
-- — sin integridad referencial, sin índices, y frágil ante nombres
-- que contuvieran el patrón.
--
-- Un dueño es un contacto O una empresa (nunca ambos): el check lo fuerza.
-- ══════════════════════════════════════════════════════════════

create table if not exists property_owners (
  id          uuid default gen_random_uuid() primary key,
  tenant_id   uuid references tenants(id)       on delete cascade not null,
  property_id uuid references properties(id)    on delete cascade not null,
  contact_id  uuid references crm_contacts(id)  on delete cascade,
  company_id  uuid references crm_companies(id) on delete cascade,
  created_at  timestamptz default now(),
  constraint owner_is_contact_or_company check (num_nonnulls(contact_id, company_id) = 1)
);

create unique index if not exists property_owners_contact_uq
  on property_owners (property_id, contact_id) where contact_id is not null;
create unique index if not exists property_owners_company_uq
  on property_owners (property_id, company_id) where company_id is not null;
create index if not exists property_owners_contact_idx on property_owners (contact_id);
create index if not exists property_owners_company_idx on property_owners (company_id);

alter table property_owners enable row level security;
drop policy if exists "tenant member" on property_owners;
create policy "tenant member" on property_owners
  for all to authenticated
  using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));

-- ── Backfill desde features->>'owners' ────────────────────────
-- Solo filas cuyo 'owners' sea un array JSON válido, y solo ids que
-- todavía existan (los colgados se descartan: eran justamente el bug).
insert into property_owners (tenant_id, property_id, contact_id, company_id)
select p.tenant_id, p.id,
       case when o->>'type' = 'contact' then (o->>'id')::uuid end,
       case when o->>'type' = 'company' then (o->>'id')::uuid end
from properties p
cross join lateral jsonb_array_elements(
  case
    when p.features ? 'owners'
     and jsonb_typeof(p.features->'owners') = 'string'
     and left(btrim(p.features->>'owners'), 1) = '['
    then (p.features->>'owners')::jsonb
    when jsonb_typeof(p.features->'owners') = 'array'
    then p.features->'owners'
    else '[]'::jsonb
  end
) o
where o->>'id' ~ '^[0-9a-fA-F-]{36}$'
  and (
    (o->>'type' = 'contact' and exists (select 1 from crm_contacts  c where c.id = (o->>'id')::uuid))
 or (o->>'type' = 'company' and exists (select 1 from crm_companies c where c.id = (o->>'id')::uuid))
  )
on conflict do nothing;

-- Verificación: cuántos quedaron migrados.
--   select count(*) from property_owners;
-- El JSON viejo en features->>'owners' se deja intacto por si hay que
-- volver atrás; se puede limpiar una vez validado.
