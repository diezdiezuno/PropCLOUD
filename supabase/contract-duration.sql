-- ══════════════════════════════════════════════════════════════
-- Duración del contrato en meses.
--
-- Antes se ponían a mano la fecha de inicio y la de vencimiento. Ahora se
-- define la fecha de firma + la duración (1 a 12 meses), y de ahí salen:
--   start_date = fecha de firma
--   end_date   = fecha de firma + N meses
-- Se siguen guardando start_date/end_date (los lee "Contratos por vencer"
-- del dashboard); esto solo agrega el dato que faltaba para calcularlos.
-- ══════════════════════════════════════════════════════════════

alter table contracts add column if not exists duration_months int;
