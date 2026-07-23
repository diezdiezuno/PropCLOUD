-- ══════════════════════════════════════════════════════════════
-- Comisión + negocio externo del ALQUILER (solo transaction = 'sale_rent').
--
-- En venta y alquiler hay dos negocios distintos: la comisión (y su
-- división con el co-broker) de la venta y la del alquiler son montos
-- diferentes. Las columnas existentes (commission*, split*) guardan la
-- VENTA (o el único negocio si es solo venta/alquiler); estas guardan el
-- ALQUILER, espejo exacto. Base de la comisión de alquiler: rent_price.
-- ══════════════════════════════════════════════════════════════

alter table contracts add column if not exists commission_rent        numeric;
alter table contracts add column if not exists commission_rent_type   text default 'pct'
  check (commission_rent_type in ('pct', 'amount'));
alter table contracts add column if not exists commission_rent_amount numeric;
alter table contracts add column if not exists split_rent_type        text default 'pct'
  check (split_rent_type in ('pct', 'amount'));
alter table contracts add column if not exists split_rent_value       numeric;
