-- ══════════════════════════════════════════════════════════════
-- Bitácora de salida de agentes.
--
-- Al borrar un agente sus fichas quedaban con `created_by` apuntando a
-- un uuid muerto: parecían tener dueño, pero nadie iba a coincidir
-- nunca con ese id. Solo el admin podía tocarlas y no había señal de
-- por qué. Verificado: las propiedades sí se salvan porque
-- `properties.agent_id` es ON DELETE SET NULL, pero contactos y
-- empresas no tienen llave foránea contra auth.users y se quedaban con
-- el uuid huérfano.
--
-- Ahora `delete-user` anota acá quién creó qué antes de soltar las
-- fichas. El dato de auditoría sobrevive al borrado del agente y también
-- a que la ficha se reasigne después, porque vive en su propia tabla.
--
-- Una fila por registro: es lo que se audita.
-- ══════════════════════════════════════════════════════════════

create table if not exists agent_offboarding_log (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,

  -- Copia, no referencia: el agente ya no existe cuando esto se lee.
  agent_auth_id  uuid,
  agent_users_id uuid,
  agent_name     text,
  agent_email    text,

  entidad        text not null check (entidad in ('crm_contacts', 'crm_companies', 'properties')),
  registro_id    uuid not null,
  registro_label text,          -- nombre o título al momento de la salida

  archivado_en   timestamptz not null default now(),
  archivado_por  uuid          -- auth.uid() del admin que ejecutó el borrado
);

create index if not exists agent_offboarding_log_tenant_idx on agent_offboarding_log (tenant_id, archivado_en desc);
create index if not exists agent_offboarding_log_registro_idx on agent_offboarding_log (entidad, registro_id);

alter table agent_offboarding_log enable row level security;

-- Solo lectura, y solo para admins: es un registro de auditoría, así que
-- nadie lo escribe desde el cliente. Lo llena `delete-user` con service
-- role, que se saltea RLS.
drop policy if exists "Admins leen la bitácora" on agent_offboarding_log;
create policy "Admins leen la bitácora" on agent_offboarding_log
  for select to authenticated
  using (is_tenant_admin(tenant_id));
