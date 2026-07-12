-- Patch: columnas reales de tarjetas y rótulos.
-- El esquema inicial las creó con `data jsonb`, pero las herramientas
-- guardan columnas planas (save_name, template, ...). Correr una vez.

alter table tarjetas
  add column if not exists save_name  text,
  add column if not exists template   text,
  add column if not exists photo_url  text,
  add column if not exists name       text,
  add column if not exists whatsapp   text,
  add column if not exists email      text,
  add column if not exists instagram  text,
  add column if not exists updated_at timestamptz default now();

alter table rotulos
  add column if not exists save_name   text,
  add column if not exists orientacion text,
  add column if not exists template    text,
  add column if not exists texto_rojo  text,
  add column if not exists name        text,
  add column if not exists whatsapp    text,
  add column if not exists email       text,
  add column if not exists updated_at  timestamptz default now();
