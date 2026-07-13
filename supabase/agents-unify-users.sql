-- Unificación de agentes: `users` (PropTools) pasa a ser la única fuente de
-- agentes, tanto para el sitio web como para asignar a propiedades/clientes.
-- La tabla `agents` queda deprecada (no se lee más; se conserva por respaldo).
-- Correr una vez.

-- 1. Campos que faltaban en users para la vitrina pública
alter table users add column if not exists show_on_web boolean not null default false;
alter table users add column if not exists bio     text;
alter table users add column if not exists twitter text;
alter table users add column if not exists youtube text;
alter table users add column if not exists threads text;

-- 2. Visibilidad web inicial = copiar del sitio actual:
--    los agents activos que matchean un user por email quedan visibles (on).
update users u set
  show_on_web = true,
  bio = coalesce(u.bio, a.bio)
from agents a
where lower(a.email) = lower(u.email)
  and a.tenant_id = u.tenant_id
  and a.is_active;

-- 3. Repuntar las propiedades: agent_id de agents.id → users.id.
--    Como agent_id tiene un FK hacia agents, hay que soltarlo primero.
alter table properties drop constraint if exists properties_agent_id_fkey;

-- 3a. Re-apuntar por email (agents.id → users.id del mismo tenant)
update properties p set agent_id = u.id
from agents a
join users u on lower(u.email) = lower(a.email) and u.tenant_id = a.tenant_id
where p.agent_id = a.id;

-- 3b. Los agent_id que no quedaron apuntando a un user (agente sin usuario) → null
update properties p set agent_id = null
where p.agent_id is not null
  and not exists (select 1 from users u where u.id = p.agent_id);

-- 3c. Nuevo FK hacia users (borra el vínculo, no la propiedad, si se elimina el user)
alter table properties
  add constraint properties_agent_id_fkey
  foreign key (agent_id) references users(id) on delete set null;

-- Nota: agents que NO tienen un user con el mismo email dejan de aparecer en
-- el sitio y sus propiedades quedan sin agente (agent_id = null). Revisar con:
--   select a.name, a.email from agents a
--   where a.is_active and not exists (
--     select 1 from users u where lower(u.email)=lower(a.email) and u.tenant_id=a.tenant_id);
