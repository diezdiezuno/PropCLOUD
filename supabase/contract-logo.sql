-- ══════════════════════════════════════════════════════════════
-- Logo para la esquina de los contratos.
--
-- El admin elige en Administración › Contratos cuál logo del tenant va en
-- el PDF (el de nav, el de footer, o uno nuevo que sube). Si no elige
-- ninguno, el PDF cae al logo de nav (tenants.logo_url).
-- ══════════════════════════════════════════════════════════════

alter table tenant_config add column if not exists contract_logo_url text;
