-- Add metadata column to leads for extra recruitment form fields
alter table leads
  add column if not exists metadata jsonb;
