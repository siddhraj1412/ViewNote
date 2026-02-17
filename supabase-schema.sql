-- ═══════════════════════════════════════════════════════════════════
-- ViewNote — Supabase PostgreSQL Schema
-- Full migration from Firebase Firestore
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- 1. PROFILES (linked to auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  "displayName" TEXT,
  username TEXT UNIQUE,
  username_lowercase TEXT UNIQUE,
  provider TEXT DEFAULT 'email',
  profile_picture_url TEXT,
  profile_banner_url TEXT,
  bio TEXT,
  "onboardingComplete" BOOLEAN DEFAULT FALSE,
  "followersCount" INTEGER DEFAULT 0,
  "followingCount" INTEGER DEFAULT 0,
  "pendingEmail" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, "displayName", provider, "createdAt")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────
-- 2. USER WATCHED
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watched (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL CHECK ("mediaType" IN ('movie', 'tv')),
  title TEXT,
  poster_path TEXT,
  "importedFrom" TEXT,
  "addedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_watched_user ON user_watched("userId");
CREATE INDEX IF NOT EXISTS idx_user_watched_user_added ON user_watched("userId", "addedAt" DESC);

-- ─────────────────────────────────────────────
-- 3. USER WATCHLIST
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watchlist (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL CHECK ("mediaType" IN ('movie', 'tv')),
  title TEXT,
  poster_path TEXT,
  "importedFrom" TEXT,
  "addedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON user_watchlist("userId");
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_added ON user_watchlist("userId", "addedAt" DESC);

-- ─────────────────────────────────────────────
-- 4. USER PAUSED
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_paused (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL CHECK ("mediaType" IN ('movie', 'tv')),
  title TEXT,
  poster_path TEXT,
  "pausedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_paused_user ON user_paused("userId");

-- ─────────────────────────────────────────────
-- 5. USER DROPPED
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_dropped (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL CHECK ("mediaType" IN ('movie', 'tv')),
  title TEXT,
  poster_path TEXT,
  "droppedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_dropped_user ON user_dropped("userId");

-- ─────────────────────────────────────────────
-- 6. USER RATINGS (scope-aware IDs for TV)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_ratings (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL CHECK ("mediaType" IN ('movie', 'tv')),
  rating REAL DEFAULT 0,
  review TEXT DEFAULT '',
  title TEXT,
  poster_path TEXT,
  username TEXT DEFAULT '',
  "ratedAt" TIMESTAMPTZ DEFAULT NOW(),
  "watchedDate" TEXT,
  liked BOOLEAN DEFAULT FALSE,
  "viewCount" INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  spoiler BOOLEAN DEFAULT FALSE,
  "likeCount" INTEGER DEFAULT 0,
  "tvTargetType" TEXT,
  "tvSeasonNumber" INTEGER,
  "tvEpisodeNumber" INTEGER,
  "seriesId" INTEGER,
  "isRewatch" BOOLEAN DEFAULT FALSE,
  "watchNumber" INTEGER,
  "importedFrom" TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_ratings_user ON user_ratings("userId");
CREATE INDEX IF NOT EXISTS idx_user_ratings_user_rated ON user_ratings("userId", "ratedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_user_ratings_media ON user_ratings("mediaId", "mediaType");

-- ─────────────────────────────────────────────
-- 7. USER WATCHING (Currently Watching)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watching (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL DEFAULT 'tv',
  title TEXT,
  poster_path TEXT,
  "addedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_watching_user ON user_watching("userId");

-- ─────────────────────────────────────────────
-- 8. USER SERIES PROGRESS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_series_progress (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "seriesId" INTEGER NOT NULL,
  "watchedSeasons" JSONB DEFAULT '[]',
  "watchedEpisodes" JSONB DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_series_progress_user ON user_series_progress("userId");

-- ─────────────────────────────────────────────
-- 9. FAVORITES (unified table with category)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('movies', 'shows', 'episodes')),
  title TEXT,
  poster_path TEXT,
  release_date TEXT,
  metadata JSONB DEFAULT '{}',
  "order" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_cat ON favorites("userId", category);

-- ─────────────────────────────────────────────
-- 10. USER MEDIA PREFERENCES (custom poster/banner)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_media_preferences (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL,
  "customPoster" TEXT,
  "customBanner" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_media_prefs_user ON user_media_preferences("userId");

-- ─────────────────────────────────────────────
-- 11. USER LISTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_lists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  items JSONB DEFAULT '[]',
  "bannerUrl" TEXT,
  "isPublic" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_lists_user ON user_lists("userId");

-- ─────────────────────────────────────────────
-- 12. USER FOLLOWS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_follows (
  id TEXT PRIMARY KEY,
  "followerId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "followingId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("followerId", "followingId")
);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows("followerId");
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows("followingId");

-- ─────────────────────────────────────────────
-- 13. REVIEW LIKES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_likes (
  id TEXT PRIMARY KEY,
  "reviewDocId" TEXT NOT NULL,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT DEFAULT '',
  "photoURL" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_likes_review ON review_likes("reviewDocId");
CREATE INDEX IF NOT EXISTS idx_review_likes_user ON review_likes("userId");

-- ─────────────────────────────────────────────
-- 14. REVIEW COMMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reviewDocId" TEXT NOT NULL,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT DEFAULT '',
  "photoURL" TEXT DEFAULT '',
  "displayName" TEXT DEFAULT '',
  text TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments("reviewDocId");

-- ─────────────────────────────────────────────
-- 15. LIST LIKES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS list_likes (
  id TEXT PRIMARY KEY,
  "listId" TEXT NOT NULL,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT DEFAULT '',
  "photoURL" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_list_likes_list ON list_likes("listId");

-- ─────────────────────────────────────────────
-- 16. LIST COMMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS list_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listId" TEXT NOT NULL,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT DEFAULT '',
  "photoURL" TEXT DEFAULT '',
  "displayName" TEXT DEFAULT '',
  text TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_list_comments_list ON list_comments("listId");

-- ─────────────────────────────────────────────
-- 17. MEDIA STATS (aggregated rating stats)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_stats (
  id TEXT PRIMARY KEY,
  "mediaId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL,
  "ratingCount" INTEGER DEFAULT 0,
  "avgRating" REAL DEFAULT 0,
  "ratingDistribution" JSONB DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_stats_media ON media_stats("mediaId", "mediaType");

-- ─────────────────────────────────────────────
-- 18. USER IMPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_imports (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  "importedAt" TIMESTAMPTZ DEFAULT NOW(),
  summary JSONB DEFAULT '{}'
);

-- ─────────────────────────────────────────────
-- 19. SOCIAL LINKS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_social_links (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  links JSONB DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (run these separately or via Dashboard)
-- ═══════════════════════════════════════════════════════════════════
-- Go to Storage in Supabase Dashboard and create:
--   1. Bucket: "avatars" (Public)
--   2. Bucket: "custom-media" (Public)
--   3. Bucket: "list-banners" (Public)

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watched ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_paused ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dropped ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watching ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_series_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_media_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_social_links ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── User media tables (watched, watchlist, paused, dropped, watching) ──
-- Select: public (to view other users' profiles)
-- Insert/Update/Delete: own data only

CREATE POLICY "user_watched select" ON user_watched FOR SELECT USING (true);
CREATE POLICY "user_watched insert" ON user_watched FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "user_watched update" ON user_watched FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "user_watched delete" ON user_watched FOR DELETE USING (auth.uid() = "userId");

CREATE POLICY "user_watchlist select" ON user_watchlist FOR SELECT USING (true);
CREATE POLICY "user_watchlist insert" ON user_watchlist FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "user_watchlist update" ON user_watchlist FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "user_watchlist delete" ON user_watchlist FOR DELETE USING (auth.uid() = "userId");

CREATE POLICY "user_paused select" ON user_paused FOR SELECT USING (true);
CREATE POLICY "user_paused insert" ON user_paused FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "user_paused update" ON user_paused FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "user_paused delete" ON user_paused FOR DELETE USING (auth.uid() = "userId");

CREATE POLICY "user_dropped select" ON user_dropped FOR SELECT USING (true);
CREATE POLICY "user_dropped insert" ON user_dropped FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "user_dropped update" ON user_dropped FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "user_dropped delete" ON user_dropped FOR DELETE USING (auth.uid() = "userId");

CREATE POLICY "user_watching select" ON user_watching FOR SELECT USING (true);
CREATE POLICY "user_watching insert" ON user_watching FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "user_watching update" ON user_watching FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "user_watching delete" ON user_watching FOR DELETE USING (auth.uid() = "userId");

-- ── Ratings ──
CREATE POLICY "ratings select" ON user_ratings FOR SELECT USING (true);
CREATE POLICY "ratings insert" ON user_ratings FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "ratings update" ON user_ratings FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "ratings delete" ON user_ratings FOR DELETE USING (auth.uid() = "userId");

-- ── Series Progress ──
CREATE POLICY "progress select" ON user_series_progress FOR SELECT USING (true);
CREATE POLICY "progress insert" ON user_series_progress FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "progress update" ON user_series_progress FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "progress delete" ON user_series_progress FOR DELETE USING (auth.uid() = "userId");

-- ── Favorites ──
CREATE POLICY "favorites select" ON favorites FOR SELECT USING (true);
CREATE POLICY "favorites insert" ON favorites FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "favorites update" ON favorites FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "favorites delete" ON favorites FOR DELETE USING (auth.uid() = "userId");

-- ── Media Preferences ──
CREATE POLICY "prefs select" ON user_media_preferences FOR SELECT USING (true);
CREATE POLICY "prefs insert" ON user_media_preferences FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "prefs update" ON user_media_preferences FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "prefs delete" ON user_media_preferences FOR DELETE USING (auth.uid() = "userId");

-- ── Lists ──
CREATE POLICY "lists select" ON user_lists FOR SELECT USING (true);
CREATE POLICY "lists insert" ON user_lists FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "lists update" ON user_lists FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "lists delete" ON user_lists FOR DELETE USING (auth.uid() = "userId");

-- ── Follows ──
CREATE POLICY "follows select" ON user_follows FOR SELECT USING (true);
CREATE POLICY "follows insert" ON user_follows FOR INSERT WITH CHECK (auth.uid() = "followerId");
CREATE POLICY "follows delete" ON user_follows FOR DELETE USING (auth.uid() = "followerId");

-- ── Review Likes ──
CREATE POLICY "review_likes select" ON review_likes FOR SELECT USING (true);
CREATE POLICY "review_likes insert" ON review_likes FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "review_likes delete" ON review_likes FOR DELETE USING (auth.uid() = "userId");

-- ── Review Comments ──
CREATE POLICY "review_comments select" ON review_comments FOR SELECT USING (true);
CREATE POLICY "review_comments insert" ON review_comments FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "review_comments delete" ON review_comments FOR DELETE USING (auth.uid() = "userId");

-- ── List Likes ──
CREATE POLICY "list_likes select" ON list_likes FOR SELECT USING (true);
CREATE POLICY "list_likes insert" ON list_likes FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "list_likes delete" ON list_likes FOR DELETE USING (auth.uid() = "userId");

-- ── List Comments ──
CREATE POLICY "list_comments select" ON list_comments FOR SELECT USING (true);
CREATE POLICY "list_comments insert" ON list_comments FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "list_comments delete" ON list_comments FOR DELETE USING (auth.uid() = "userId");

-- ── Media Stats (public read, service writes) ──
CREATE POLICY "stats select" ON media_stats FOR SELECT USING (true);
CREATE POLICY "stats insert" ON media_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "stats update" ON media_stats FOR UPDATE USING (true);

-- ── Imports ──
CREATE POLICY "imports select" ON user_imports FOR SELECT USING (auth.uid() = "userId");
CREATE POLICY "imports insert" ON user_imports FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "imports update" ON user_imports FOR UPDATE USING (auth.uid() = "userId");

-- ── Social Links ──
CREATE POLICY "social select" ON user_social_links FOR SELECT USING (true);
CREATE POLICY "social insert" ON user_social_links FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "social update" ON user_social_links FOR UPDATE USING (auth.uid() = "userId");

-- ═══════════════════════════════════════════════════════════════════
-- REALTIME — Enable for tables that need live updates
-- ═══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE user_watched;
ALTER PUBLICATION supabase_realtime ADD TABLE user_watchlist;
ALTER PUBLICATION supabase_realtime ADD TABLE user_paused;
ALTER PUBLICATION supabase_realtime ADD TABLE user_dropped;
ALTER PUBLICATION supabase_realtime ADD TABLE user_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE user_watching;
ALTER PUBLICATION supabase_realtime ADD TABLE review_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE user_follows;
ALTER PUBLICATION supabase_realtime ADD TABLE media_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE user_media_preferences;

-- ═══════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS (for atomic multi-table operations)
-- ═══════════════════════════════════════════════════════════════════

-- Transition media status atomically (delete from all others, upsert into target)
CREATE OR REPLACE FUNCTION transition_media_status(
  p_id TEXT,
  p_user_id UUID,
  p_media_id INTEGER,
  p_media_type TEXT,
  p_target_status TEXT,
  p_title TEXT DEFAULT '',
  p_poster_path TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
  -- Delete from all status tables
  IF p_target_status != 'watched' THEN
    DELETE FROM user_watched WHERE id = p_id;
  END IF;
  IF p_target_status != 'watchlist' THEN
    DELETE FROM user_watchlist WHERE id = p_id;
  END IF;
  IF p_target_status != 'paused' THEN
    DELETE FROM user_paused WHERE id = p_id;
  END IF;
  IF p_target_status != 'dropped' THEN
    DELETE FROM user_dropped WHERE id = p_id;
  END IF;

  -- Insert into target
  IF p_target_status = 'watched' THEN
    INSERT INTO user_watched (id, "userId", "mediaId", "mediaType", title, poster_path, "addedAt")
    VALUES (p_id, p_user_id, p_media_id, p_media_type, p_title, p_poster_path, NOW())
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, poster_path = EXCLUDED.poster_path, "addedAt" = NOW();
  ELSIF p_target_status = 'watchlist' THEN
    INSERT INTO user_watchlist (id, "userId", "mediaId", "mediaType", title, poster_path, "addedAt")
    VALUES (p_id, p_user_id, p_media_id, p_media_type, p_title, p_poster_path, NOW())
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, poster_path = EXCLUDED.poster_path, "addedAt" = NOW();
  ELSIF p_target_status = 'paused' THEN
    INSERT INTO user_paused (id, "userId", "mediaId", "mediaType", title, poster_path, "pausedAt")
    VALUES (p_id, p_user_id, p_media_id, p_media_type, p_title, p_poster_path, NOW())
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, poster_path = EXCLUDED.poster_path, "pausedAt" = NOW();
  ELSIF p_target_status = 'dropped' THEN
    INSERT INTO user_dropped (id, "userId", "mediaId", "mediaType", title, poster_path, "droppedAt")
    VALUES (p_id, p_user_id, p_media_id, p_media_type, p_title, p_poster_path, NOW())
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, poster_path = EXCLUDED.poster_path, "droppedAt" = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Follow/unfollow with counter updates
CREATE OR REPLACE FUNCTION follow_user(p_follower_id UUID, p_following_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_follows (id, "followerId", "followingId", "createdAt")
  VALUES (p_follower_id || '_' || p_following_id, p_follower_id, p_following_id, NOW())
  ON CONFLICT DO NOTHING;

  UPDATE profiles SET "followingCount" = COALESCE("followingCount", 0) + 1 WHERE id = p_follower_id;
  UPDATE profiles SET "followersCount" = COALESCE("followersCount", 0) + 1 WHERE id = p_following_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unfollow_user(p_follower_id UUID, p_following_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM user_follows WHERE "followerId" = p_follower_id AND "followingId" = p_following_id;
  UPDATE profiles SET "followingCount" = GREATEST(0, COALESCE("followingCount", 0) - 1) WHERE id = p_follower_id;
  UPDATE profiles SET "followersCount" = GREATEST(0, COALESCE("followersCount", 0) - 1) WHERE id = p_following_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle review like with counter
CREATE OR REPLACE FUNCTION toggle_review_like(
  p_review_doc_id TEXT,
  p_user_id UUID,
  p_username TEXT DEFAULT '',
  p_photo_url TEXT DEFAULT ''
) RETURNS TABLE(liked BOOLEAN, count INTEGER) AS $$
DECLARE
  v_like_id TEXT;
  v_was_liked BOOLEAN;
  v_count INTEGER;
BEGIN
  v_like_id := p_review_doc_id || '_' || p_user_id;

  -- Check if already liked
  SELECT EXISTS(SELECT 1 FROM review_likes WHERE id = v_like_id) INTO v_was_liked;

  IF v_was_liked THEN
    DELETE FROM review_likes WHERE id = v_like_id;
    UPDATE user_ratings SET "likeCount" = GREATEST(0, COALESCE("likeCount", 0) - 1) WHERE id = p_review_doc_id;
  ELSE
    INSERT INTO review_likes (id, "reviewDocId", "userId", username, "photoURL", "createdAt")
    VALUES (v_like_id, p_review_doc_id, p_user_id, p_username, p_photo_url, NOW())
    ON CONFLICT (id) DO NOTHING;
    UPDATE user_ratings SET "likeCount" = COALESCE("likeCount", 0) + 1 WHERE id = p_review_doc_id;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count FROM review_likes WHERE "reviewDocId" = p_review_doc_id;

  RETURN QUERY SELECT NOT v_was_liked, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete account cascade
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM user_watched WHERE "userId" = p_user_id;
  DELETE FROM user_watchlist WHERE "userId" = p_user_id;
  DELETE FROM user_paused WHERE "userId" = p_user_id;
  DELETE FROM user_dropped WHERE "userId" = p_user_id;
  DELETE FROM user_ratings WHERE "userId" = p_user_id;
  DELETE FROM user_watching WHERE "userId" = p_user_id;
  DELETE FROM user_series_progress WHERE "userId" = p_user_id;
  DELETE FROM favorites WHERE "userId" = p_user_id;
  DELETE FROM user_media_preferences WHERE "userId" = p_user_id;
  DELETE FROM user_lists WHERE "userId" = p_user_id;
  DELETE FROM user_follows WHERE "followerId" = p_user_id OR "followingId" = p_user_id;
  DELETE FROM review_likes WHERE "userId" = p_user_id;
  DELETE FROM review_comments WHERE "userId" = p_user_id;
  DELETE FROM list_likes WHERE "userId" = p_user_id;
  DELETE FROM list_comments WHERE "userId" = p_user_id;
  DELETE FROM user_imports WHERE "userId" = p_user_id;
  DELETE FROM user_social_links WHERE "userId" = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════
-- STORAGE POLICIES (run after creating buckets in Dashboard)
-- ═══════════════════════════════════════════════════════════════════
-- Avatars bucket
-- CREATE POLICY "Avatar upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
-- CREATE POLICY "Avatar read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Avatar update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
-- CREATE POLICY "Avatar delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

-- Custom media bucket
-- CREATE POLICY "Custom media upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'custom-media' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
-- CREATE POLICY "Custom media read" ON storage.objects FOR SELECT USING (bucket_id = 'custom-media');
-- CREATE POLICY "Custom media update" ON storage.objects FOR UPDATE USING (bucket_id = 'custom-media' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
-- CREATE POLICY "Custom media delete" ON storage.objects FOR DELETE USING (bucket_id = 'custom-media' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
