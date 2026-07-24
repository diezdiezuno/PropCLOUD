-- ══════════════════════════════════════════════════════════════
-- Cédula del agente (users.cedula).
--
-- El agente la llena inline en su dashboard, junto al resto de sus datos.
-- Sirve, entre otras cosas, para los contratos ({{agente.cedula}}).
-- Texto libre: hay cédula física, jurídica y pasaportes; no se valida acá.
-- ══════════════════════════════════════════════════════════════

alter table users add column if not exists cedula text;
