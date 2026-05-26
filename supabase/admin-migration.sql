-- ─── TENANT ADMINS ──────────────────────────────────────────────────────────
-- Links auth.users to tenants (one user can admin one tenant)

CREATE TABLE IF NOT EXISTS tenant_admins (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read own" ON tenant_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- ─── EXTEND TENANT_CONFIG ───────────────────────────────────────────────────

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS map_center_lat  DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS map_center_lng  DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS map_zoom        INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS listing_view    TEXT DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS listing_cols    INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS listing_sort    TEXT DEFAULT 'price_asc',
  ADD COLUMN IF NOT EXISTS detail_sections JSONB DEFAULT '["gallery","info","stats","description","agent"]'::jsonb,
  ADD COLUMN IF NOT EXISTS detail_show_map BOOLEAN DEFAULT true;


-- ─── RLS: ADMIN WRITE POLICIES ──────────────────────────────────────────────

-- Tenants: admins can update their own tenant row
CREATE POLICY "Admins update tenant" ON tenants
  FOR UPDATE TO authenticated
  USING (id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));

-- Tenant config: admins can read + write their own config
CREATE POLICY "Admins read own config" ON tenant_config
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins upsert own config" ON tenant_config
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));

-- Property sources: admins can CRUD
CREATE POLICY "Admins manage sources" ON property_sources
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));

-- Agents: admins can CRUD
CREATE POLICY "Admins manage agents" ON agents
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));


-- ─── INSTRUCTIONS ────────────────────────────────────────────────────────────
-- After running this migration, create a tenant admin record manually:
--
--   INSERT INTO tenant_admins (tenant_id, user_id)
--   SELECT t.id, '<auth-user-uuid>'
--   FROM tenants t WHERE t.slug = 'sunrise';
--
-- The user must first sign up via magic link so their auth.users record exists.
-- You can find the user_id in Supabase Dashboard → Authentication → Users.
