-- ══════════════════════════════════════════════════════════════
-- Plantillas de contrato (Administración › Contratos).
--
-- El admin define cada tipo —captación, oferta, opción de compraventa…—
-- con su texto fijo. Dentro del texto van marcadores {{propiedad.precio}}
-- que se reemplazan con los datos de la propiedad al generarlo. Así un
-- tipo nuevo no exige programar nada: se escribe y ya.
--
-- El cuerpo se guarda como texto plano con los marcadores adentro; el
-- catálogo de variables disponibles vive en src/lib/contract-render.ts,
-- que es también quien las reemplaza.
-- ══════════════════════════════════════════════════════════════

create table if not exists contract_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  nombre      text not null,              -- "Contrato de captación"
  descripcion text,                       -- ayuda para el agente que lo elige
  cuerpo      text not null default '',   -- texto fijo con {{variables}}
  position    int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contract_templates_tenant_idx
  on contract_templates (tenant_id, position);

alter table contract_templates enable row level security;

-- Las lee toda la oficina: el agente necesita elegir una al generar.
drop policy if exists "plantillas leer" on contract_templates;
create policy "plantillas leer" on contract_templates
  for select to authenticated
  using (is_tenant_member(tenant_id));

-- Solo el admin las define: el texto de un contrato no lo cambia un agente.
drop policy if exists "plantillas admin" on contract_templates;
create policy "plantillas admin" on contract_templates
  for all to authenticated
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));

-- Cada contrato de una propiedad sale de una plantilla. Nullable: los
-- contratos que ya existían no tienen ninguna y se siguen viendo.
alter table contracts add column if not exists template_id uuid
  references contract_templates(id) on delete set null;
