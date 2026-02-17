-- ═══════════════════════════════════════════════════════════════
-- ViewNote: Missing Columns Migration
-- Run this in Supabase SQL Editor to fix:
--   1. Social links & location not saving
--   2. List creation save error ({})
-- ═══════════════════════════════════════════════════════════════

-- Fix: Social links and location not saving on profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "socialLinks" JSONB DEFAULT '[]'::jsonb;

-- Fix: List creation failing with {} error
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS "listType" TEXT DEFAULT 'general';
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS ranked BOOLEAN DEFAULT FALSE;
