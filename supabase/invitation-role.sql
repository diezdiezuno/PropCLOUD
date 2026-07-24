-- La invitación ahora lleva el rol con que nace la cuenta. Hasta acá toda
-- invitación creaba un agente; el alta de tenant necesita sembrar el admin que
-- va a configurarlo. `activate-invitation` lee esta columna y pone `users.role`,
-- y el trigger `users_sync_tenant_admins` crea la fila en `tenant_admins` solo.
alter table invitations
  add column if not exists role text not null default 'agent'
  check (role in ('agent', 'admin'));
