-- ══════════════════════════════════════════════════════════════
-- Archivos generales de la propiedad (tab Archivos).
--
-- Igual que crm_contacts/crm_companies: un arreglo [{name,url}] en
-- doc_urls. El informe registral y el plano catastrado siguen en
-- features (informe_registral_url / plano_catastrado_url); esto es para
-- todo lo demás que se quiera adjuntar. Los archivos van al bucket
-- privado property-docs (ruta <tenantId>/…), ya aislado por oficina.
-- ══════════════════════════════════════════════════════════════

alter table properties add column if not exists doc_urls jsonb default '[]'::jsonb;
