-- ─── SUPER ADMINS ───────────────────────────────────────────────────────────
-- Users who can manage ALL tenants (platform operators)

CREATE TABLE IF NOT EXISTS super_admins (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read own" ON super_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- ─── INSTRUCTIONS ────────────────────────────────────────────────────────────
-- After running, add yourself as super admin:
--
--   INSERT INTO super_admins (user_id)
--   SELECT id FROM auth.users WHERE email = 'tu@email.com';
