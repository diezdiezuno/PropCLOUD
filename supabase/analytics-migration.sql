-- Add Google Analytics Measurement ID to tenant_config
alter table tenant_config
  add column if not exists ga_id text;
