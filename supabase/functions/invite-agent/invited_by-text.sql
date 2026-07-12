-- La función invite-agent guarda `invited_by` como nombre (texto) y el
-- registro lo muestra como tal. La migración lo creó como uuid — corregir.
-- Correr una vez antes de usar la función.

alter table invitations
  alter column invited_by type text using invited_by::text;
