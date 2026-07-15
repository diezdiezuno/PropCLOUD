-- ══════════════════════════════════════════════════════════════
-- Referidos en el CRM de contactos.
--  · contact_types.role marca los dos tipos especiales de referido.
--  · crm_contacts guarda a quién refiere / de quién es referido.
--    El referidor puede ser un asesor interno (users) o un contacto
--    (crm_contacts), por eso hay un par de columnas para cada dirección.
-- ══════════════════════════════════════════════════════════════

-- 1) Rol en la taxonomía de tipos (editable, pero reconocible por código)
alter table contact_types
  add column if not exists role text
  check (role in ('referral_in', 'referral_out'));

-- 2) Columnas de referral en crm_contacts (polimórfico: user o contacto)
alter table crm_contacts
  add column if not exists referred_by_user_id    uuid references users(id)        on delete set null,
  add column if not exists referred_by_contact_id uuid references crm_contacts(id) on delete set null,
  add column if not exists referred_to_user_id    uuid references users(id)        on delete set null,
  add column if not exists referred_to_contact_id uuid references crm_contacts(id) on delete set null;

-- 3) Sembrar los dos tipos por tenant (solo si aún no existen por rol)
insert into contact_types (tenant_id, name, color, position, role)
select t.id, 'Referido ←', '#8B5CF6', 900, 'referral_in'
from tenants t
where not exists (
  select 1 from contact_types ct where ct.tenant_id = t.id and ct.role = 'referral_in'
);

insert into contact_types (tenant_id, name, color, position, role)
select t.id, 'Referido →', '#EC4899', 901, 'referral_out'
from tenants t
where not exists (
  select 1 from contact_types ct where ct.tenant_id = t.id and ct.role = 'referral_out'
);
