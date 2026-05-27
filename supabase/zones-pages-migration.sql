-- Migration: zone_config and pages_config for tenant_config
-- Run this in the Supabase SQL editor

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS zone_config  jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pages_config jsonb DEFAULT NULL;

-- zone_config: null = show all predefined zones, array of strings = enabled zone keys
-- pages_config: null = use defaults, array of PageConfig objects = custom page visibility/order

COMMENT ON COLUMN tenant_config.zone_config IS
  'null = all predefined zones shown; string[] = list of enabled zone search keys';

COMMENT ON COLUMN tenant_config.pages_config IS
  'null = default page visibility; PageConfig[] = {slug,title,visible,order,custom}';
