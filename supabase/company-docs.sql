-- Documentos de empresa: personerías, poderes especiales, actas.
--
-- Misma forma que `crm_contacts.doc_urls` —un array de {path, name, size,
-- uploaded_at}— y el mismo bucket `contact-docs`, bajo el prefijo `empresas/`.
-- Se reusa el bucket a propósito: ya es privado, ya limita a PDF e imágenes
-- hasta 20 MB y ya tiene sus policies probadas. Un bucket nuevo sería otro
-- juego de permisos que mantener y otro lugar donde equivocarse.

alter table crm_companies
  add column if not exists doc_urls jsonb not null default '[]'::jsonb;
