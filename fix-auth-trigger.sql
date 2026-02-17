-- ═══════════════════════════════════════════════════════════════════
-- FIX: Auth Trigger — "Database error saving new user"
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- The original trigger failed silently and rolled back the entire
-- auth.users INSERT, blocking all signups (email + Google OAuth).
-- Root causes:
--   1. No EXCEPTION handler → any failure aborts the transaction
--   2. Missing SET search_path → can't find public.profiles
--   3. No fallback for NULL email (some OAuth flows)

-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    "displayName",
    provider,
    "createdAt",
    "updatedAt"
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'user' END
    ),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    "displayName" = COALESCE(
      NULLIF(EXCLUDED."displayName", ''),
      public.profiles."displayName"
    ),
    provider = COALESCE(EXCLUDED.provider, public.profiles.provider),
    "updatedAt" = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER block user creation — log the error and continue
  RAISE LOG 'handle_new_user() failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also grant the function owner (postgres) INSERT on profiles
-- (should already exist, but ensure it)
GRANT ALL ON public.profiles TO postgres;
GRANT ALL ON public.profiles TO service_role;

-- Verify: check if there are any orphaned auth.users without profiles
-- and backfill them
INSERT INTO public.profiles (id, email, "displayName", provider, "createdAt", "updatedAt")
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'display_name',
    au.raw_user_meta_data->>'full_name',
    CASE WHEN au.email IS NOT NULL THEN split_part(au.email, '@', 1) ELSE 'user' END
  ),
  COALESCE(au.raw_app_meta_data->>'provider', 'email'),
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- FIX: Follow/Unfollow RPC — prevent count desync
-- The original functions always incremented/decremented counts even
-- when the follow already existed or didn't exist.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION follow_user(p_follower_id UUID, p_following_id UUID)
RETURNS VOID AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO user_follows (id, "followerId", "followingId", "createdAt")
  VALUES (p_follower_id || '_' || p_following_id, p_follower_id, p_following_id, NOW())
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Only update counts if a new follow was actually inserted
  IF v_count > 0 THEN
    UPDATE profiles SET "followingCount" = COALESCE("followingCount", 0) + 1 WHERE id = p_follower_id;
    UPDATE profiles SET "followersCount" = COALESCE("followersCount", 0) + 1 WHERE id = p_following_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unfollow_user(p_follower_id UUID, p_following_id UUID)
RETURNS VOID AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM user_follows WHERE "followerId" = p_follower_id AND "followingId" = p_following_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Only decrement counts if a follow was actually removed
  IF v_count > 0 THEN
    UPDATE profiles SET "followingCount" = GREATEST(0, COALESCE("followingCount", 0) - 1) WHERE id = p_follower_id;
    UPDATE profiles SET "followersCount" = GREATEST(0, COALESCE("followersCount", 0) - 1) WHERE id = p_following_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════
-- FIX: Favorites table — support episode composite IDs + metadata
-- ═══════════════════════════════════════════════════════════════════

-- Change mediaId from INTEGER to TEXT (episodes use composite IDs like "12345_s1e3")
ALTER TABLE favorites ALTER COLUMN "mediaId" TYPE TEXT USING "mediaId"::TEXT;

-- Add metadata JSONB column for episode-specific data (seriesId, seasonNumber, etc.)
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
