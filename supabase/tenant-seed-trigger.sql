-- ══════════════════════════════════════════════════════════════
-- Auto-seed de un tenant nuevo.
--
-- Hasta ahora las taxonomías (tipos/estados/amenidades de propiedad,
-- tipos/fuentes de contacto) se sembraban con migraciones de una sola
-- vez que recorrían los tenants existentes. Un tenant creado después
-- quedaba vacío → sin tipos de propiedad, y los referidos rotos (dependen
-- de los contact_types con rol referral_in/out).
--
-- Este trigger siembra los defaults en cada INSERT de tenants, sin
-- importar cómo se cree (UI de superadmin, SQL directo, etc.).
-- security definer: corre con permisos del owner, así inserta en las
-- tablas de taxonomía sin depender de la RLS del que crea el tenant.
--
-- No toca los tenants existentes (solo dispara en filas nuevas).
-- Defaults genéricos: se quitó lo específico de REMAX/Sunrise; cada
-- tenant ajusta lo suyo desde el admin del CRM.
-- ══════════════════════════════════════════════════════════════

create or replace function seed_new_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Tipos de propiedad
  insert into property_types (tenant_id, label, value, icon, sort_order) values
    (new.id, 'Casa',            'casa',            null, 1),
    (new.id, 'Apartamento',     'apartamento',     null, 2),
    (new.id, 'Lote',            'lote',            null, 3),
    (new.id, 'Local comercial', 'local_comercial', null, 4),
    (new.id, 'Finca',           'finca',           null, 5),
    (new.id, 'Oficina',         'oficina',         null, 6),
    (new.id, 'Bodega',          'bodega',          null, 7),
    (new.id, 'Condominio',      'condominio',      null, 8);

  -- Estados CRM (web_status = comportamiento del sitio público)
  insert into property_statuses (tenant_id, value, label, web_status, position) values
    (new.id, 'draft',       'Borrador',            'inactive', 0),
    (new.id, 'captacion',   'En captación',        'inactive', 1),
    (new.id, 'preparacion', 'En preparación',      'inactive', 2),
    (new.id, 'lista',       'Lista para publicar', 'inactive', 3),
    (new.id, 'active',      'Publicada',           'active',   4),
    (new.id, 'bajo_oferta', 'Bajo oferta',         'inactive', 5),
    (new.id, 'sold',        'Vendida / Alquilada', 'sold',     6),
    (new.id, 'archived',    'Archivada',           'inactive', 7);

  -- Amenidades
  insert into property_amenities (tenant_id, name, position)
  select new.id, name, ord
  from unnest(array[
    'Piscina','Jacuzzi','Sauna','Gimnasio','Cancha deportiva','Área de juegos',
    'Seguridad 24h','Portón eléctrico','Cámaras de seguridad','BBQ / Rancho',
    'Jardín','Terraza','Balcón','Cuarto de servicio','Bodega','Elevador',
    'Generador','Placas solares','Cisterna','Vista al mar','Vista al volcán',
    'Vista al valle','Aire acondicionado','Calefacción','Área gourmet',
    'Salón de eventos','Parqueo visitas'
  ]) with ordinality as a(name, ord);

  -- Tipos de contacto (incluye los dos de referido, reconocidos por rol)
  insert into contact_types (tenant_id, name, color, position, role) values
    (new.id, 'Vendedor',      '#16A34A', 0,   null),
    (new.id, 'Comprador',     '#1B6EF3', 1,   null),
    (new.id, 'Arrendatario',  '#EA34E4', 2,   null),
    (new.id, 'Inversionista', '#F59E0B', 3,   null),
    (new.id, 'Asesor externo','#84CC16', 4,   null),
    (new.id, 'Referido ←',    '#8B5CF6', 900, 'referral_in'),
    (new.id, 'Referido →',    '#EC4899', 901, 'referral_out');

  -- Fuentes de contacto (genéricas)
  insert into contact_sources (tenant_id, name, position)
  select new.id, name, ord
  from unnest(array[
    'Sitio web','WhatsApp','Referido','Portal','Llamada','Redes sociales','Otro'
  ]) with ordinality as s(name, ord);

  return new;
end $$;

drop trigger if exists trg_seed_new_tenant on tenants;
create trigger trg_seed_new_tenant
  after insert on tenants
  for each row execute function seed_new_tenant();
