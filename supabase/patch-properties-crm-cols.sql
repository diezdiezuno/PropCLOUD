-- Patch: columnas del CRM que faltaban en `properties`.
-- El schema.sql base quedó con el modelo viejo (title/description simples,
-- sin ubicación CR, medidas extra, bilingüe ni features). El CRM de admin
-- y el importador Remax escriben estas columnas; sin ellas Supabase tira
-- "Could not find the '<col>' column of 'properties'". Correr una vez.

alter table properties
  -- Estado / gestión CRM
  add column if not exists crm_status   text,
  add column if not exists mandate_type text,
  -- Ubicación Costa Rica
  add column if not exists provincia    text,
  add column if not exists canton       text,
  add column if not exists distrito     text,
  add column if not exists finca_number text,
  add column if not exists plano_number text,
  -- Medidas y espacios
  add column if not exists lot_m2       numeric,
  add column if not exists parking      int,
  add column if not exists floors       int,
  add column if not exists year_built   int,
  -- Contenido
  add column if not exists amenities    text[],
  add column if not exists video_url    text,
  add column if not exists features     jsonb,
  -- Bilingüe (importador Remax + sitio web)
  add column if not exists title_es       text,
  add column if not exists title_en       text,
  add column if not exists type_es        text,
  add column if not exists type_en        text,
  add column if not exists description_es text,
  add column if not exists description_en text;
