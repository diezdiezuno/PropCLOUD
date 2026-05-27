-- Migration: Detail layout selector
-- Run this in Supabase SQL Editor

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS detail_layout text DEFAULT 'C';
