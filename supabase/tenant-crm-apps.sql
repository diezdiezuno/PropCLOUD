-- Menús de CRM activables por tenant, espejo de proptools_apps para tools.
-- NULL = todos prendidos (retrocompatible: los tenants existentes no cambian
-- sin tocar nada). Un array explícito es la allowlist; [] = todos apagados.
-- Claves: propiedades, contactos, empresas, leads.
alter table tenants add column if not exists crm_apps text[];
