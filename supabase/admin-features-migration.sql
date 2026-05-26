-- Migration: Admin panel features (social links, footer logo, listing views, detail contact mode)
-- Run this in Supabase SQL Editor

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS youtube              text,
  ADD COLUMN IF NOT EXISTS tiktok               text,
  ADD COLUMN IF NOT EXISTS twitter              text,
  ADD COLUMN IF NOT EXISTS footer_logo_url      text,
  ADD COLUMN IF NOT EXISTS listing_views        jsonb,
  ADD COLUMN IF NOT EXISTS detail_contact_mode  text DEFAULT 'agent';
