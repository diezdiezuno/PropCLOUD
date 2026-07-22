-- ══════════════════════════════════════════════════════════════
-- Storage de propiedades: arreglar `property-docs` y crear el bucket
-- de fotos que el código usa y no existía.
--
-- Dos cosas rotas, encontradas probando con una sesión de agente real:
--
-- 1. `property-docs` no tiene policy de INSERT, así que adjuntar un
--    informe registral o un plano catastrado siempre falló. El bucket
--    está vacío: nunca se subió nada. Y falla callado, porque
--    `uploadDoc` devuelve null cuando hay error y la propiedad se guarda
--    igual, sin el documento.
--
-- 2. `property-photos` no existe. El código sube ahí, así que agregar
--    fotos a una propiedad responde "Bucket not found".
--
-- De paso `property-docs` pasa a privado: son documentos registrales que
-- solo mira la oficina, y estando vacío no hay ninguna URL vieja que
-- romper. Las fotos sí son públicas — las muestra el sitio.
-- ══════════════════════════════════════════════════════════════

-- Las dos rutas empiezan con el tenant: `<tenantId>/…`. Se valida la
-- forma antes de castear, porque un uuid inválido dentro de una policy
-- aborta la consulta entera en vez de dar falso.
create or replace function tenant_de_ruta(ruta text) returns uuid
language sql immutable set search_path = public, storage as $$
  select case
    when (storage.foldername(ruta))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(ruta))[1])::uuid
  end
$$;

-- ── El bucket de fotos que faltaba ────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- ── Documentos registrales: privados ──────────────────────────────
update storage.buckets
   set public = false,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'property-docs';

-- ── Policies ──────────────────────────────────────────────────────
do $$
declare
  b text;
begin
  foreach b in array array['property-docs', 'property-photos'] loop
    execute format('drop policy if exists %I on storage.objects', b || ' lee la oficina');
    execute format('drop policy if exists %I on storage.objects', b || ' escribe la oficina');

    -- Leer: cualquier miembro de la oficina dueña de la ruta. Para las
    -- fotos, además, el sitio público las sirve por URL directa: el
    -- bucket es público y esa lectura no pasa por acá.
    execute format($f$
      create policy %I on storage.objects
        for select to authenticated
        using (bucket_id = %L and is_tenant_member(tenant_de_ruta(name)))
    $f$, b || ' lee la oficina', b);

    -- Escribir, reemplazar y borrar: lo mismo. `upsert` necesita update.
    execute format($f$
      create policy %I on storage.objects
        for all to authenticated
        using      (bucket_id = %L and is_tenant_member(tenant_de_ruta(name)))
        with check (bucket_id = %L and is_tenant_member(tenant_de_ruta(name)))
    $f$, b || ' escribe la oficina', b, b);
  end loop;
end $$;
