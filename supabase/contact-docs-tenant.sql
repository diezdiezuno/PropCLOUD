-- ══════════════════════════════════════════════════════════════
-- `contact-docs` se compartía entre oficinas.
--
-- Verificado con dos sesiones reales: un agente de Sunrise podía listar
-- la carpeta, firmar y descargar un documento subido por REMAX Central.
-- Ahí viven las cédulas de los contactos y ahora también las personerías
-- y poderes de las empresas. El bucket es privado —un anónimo no entra—
-- pero cualquier usuario autenticado del proyecto sí, sin importar de
-- qué oficina sea. Y como podía listar carpetas, ni siquiera hacía falta
-- adivinar un uuid.
--
-- Esto es anterior a los documentos de empresa; ya pasaba con los de
-- contactos.
-- ══════════════════════════════════════════════════════════════

-- ¿De qué oficina es este archivo? Se deduce del registro dueño, no de la
-- ruta, así que no hay forma de mentir con un path armado a mano.
--
-- Dos formas de ruta conviven: `<contactoId>/archivo` para personas y
-- `empresas/<empresaId>/archivo` para jurídicas.
create or replace function puedo_ver_doc(ruta text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select case
    when (storage.foldername(ruta))[1] = 'empresas' then exists (
      select 1 from crm_companies c
       where c.id::text = (storage.foldername(ruta))[2]
         and is_tenant_member(c.tenant_id))
    else exists (
      select 1 from crm_contacts c
       where c.id::text = (storage.foldername(ruta))[1]
         and is_tenant_member(c.tenant_id))
  end
$$;

-- RESTRICTIVE a propósito: se combina con AND sobre las policies que ya
-- existen, en vez de reemplazarlas. Así no hay que borrar nada —ni
-- averiguar qué otras policies cubren este y otros buckets a la vez— y
-- ninguna permisiva puede volver a abrir lo que esta cierra.
--
-- Para cualquier otro bucket la condición da true y no cambia nada.
drop policy if exists "contact-docs solo la oficina dueña" on storage.objects;
create policy "contact-docs solo la oficina dueña" on storage.objects
  as restrictive
  for all
  to public
  using      (bucket_id <> 'contact-docs' or puedo_ver_doc(name))
  with check (bucket_id <> 'contact-docs' or puedo_ver_doc(name));

-- Efecto lateral esperado: si se borra el contacto o la empresa, sus
-- archivos dejan de ser accesibles. Ya eran huérfanos; ahora además están
-- cerrados. Se limpian con service role.
