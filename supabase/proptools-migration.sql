-- ══════════════════════════════════════════════════════════════
-- PropTools por tenant: lista de herramientas activas según plan.
-- El sidebar de Noduus muestra el grupo PropTools solo con las
-- herramientas incluidas acá. Se administra manualmente (o luego
-- desde superadmin).
-- Slugs válidos: firmas, tarjetas, rotulos, valoraciones,
--                calendario, equipos
-- ══════════════════════════════════════════════════════════════

alter table tenants add column if not exists proptools_apps text[] not null default '{}';

-- Ejemplo: activar todas las herramientas para un tenant
-- update tenants set proptools_apps = '{firmas,tarjetas,rotulos,valoraciones,calendario,equipos}'
-- where slug = 'sunrise';
