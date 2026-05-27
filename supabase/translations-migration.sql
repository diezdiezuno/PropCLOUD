-- Translation cache: stores auto-translated descriptions so each property
-- is only translated once. No re-translation unless the English text changes.

CREATE TABLE IF NOT EXISTS property_translations (
  external_id   text        NOT NULL,
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_text   text        NOT NULL,          -- original EN text (for change detection)
  description_es text       NOT NULL,
  translated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (external_id, tenant_id)
);

-- RLS: only service role writes; no public read needed (server-side only)
ALTER TABLE property_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON property_translations
  USING (true) WITH CHECK (true);

-- Index for fast lookups by tenant
CREATE INDEX IF NOT EXISTS idx_prop_translations_tenant
  ON property_translations (tenant_id);
