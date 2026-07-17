-- ══════════════════════════════════════════════════════════════
-- Media de propiedad: varios videos + tour 360.
--
-- Antes había un único properties.video_url (y vivía en el tab
-- Descripción). Ahora Media agrupa fotos, videos y 360.
--
-- El 360 es un link externo (Matterport/Kuula/etc): guardamos la URL,
-- el hosting lo hace el proveedor.
-- ══════════════════════════════════════════════════════════════

alter table properties
  add column if not exists video_urls text[] not null default '{}',
  add column if not exists tour_url   text;

-- Backfill: el video único pasa a ser el primero del array.
update properties
set    video_urls = array[video_url]
where  video_url is not null
  and  btrim(video_url) <> ''
  and  video_urls = '{}';

-- video_url queda como estaba (sin uso) por si hay que volver atrás.
-- Verificación:
--   select count(*) from properties where array_length(video_urls, 1) > 0;
