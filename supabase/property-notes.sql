-- ══════════════════════════════════════════════════════════════
-- Notas de la propiedad (tab Notas).
--
-- Bitácora, no un campo editable: cada nota queda con su fecha, hora y
-- autor. Por eso es append-only — sin policy de update ni delete. Si una
-- nota quedó mal, se agrega otra; así el historial no se puede reescribir.
--
-- El nombre del autor se copia además del id: si el agente se va y su
-- fila desaparece, la nota sigue diciendo quién la escribió (mismo
-- criterio que agent_offboarding_log).
-- ══════════════════════════════════════════════════════════════

create table if not exists property_notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id)    on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  texto       text not null,
  autor_id    uuid,                       -- auth.uid() del que la escribió
  autor_nombre text,                      -- copiado, sobrevive al borrado
  created_at  timestamptz not null default now()
);

create index if not exists property_notes_prop_idx
  on property_notes (property_id, created_at desc);

alter table property_notes enable row level security;

-- Las lee toda la oficina: una nota sirve para que el equipo se entere.
drop policy if exists "notas leer" on property_notes;
create policy "notas leer" on property_notes
  for select to authenticated
  using (is_tenant_member(tenant_id));

-- Las escribe cualquier miembro, siempre a nombre propio: sin el check de
-- autor_id se podría firmar una nota como otra persona.
drop policy if exists "notas escribir" on property_notes;
create policy "notas escribir" on property_notes
  for insert to authenticated
  with check (is_tenant_member(tenant_id) and autor_id = auth.uid());

-- Sin update ni delete a propósito: es un registro, no un borrador.
