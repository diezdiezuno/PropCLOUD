-- Thumbnail del material guardado (rótulos y tarjetas).
-- Lo genera la herramienta al guardar: escala el canvas de preview y lo
-- sube a Cloudinary (preset `firmas`, el mismo que usa el dashboard).
-- Los guardados viejos quedan con thumb_url null → el dashboard cae al
-- chip con ícono hasta que se vuelvan a guardar.

alter table rotulos  add column if not exists thumb_url text;
alter table tarjetas add column if not exists thumb_url text;
