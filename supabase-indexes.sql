-- ═══════════════════════════════════════════════════════════════════
-- ViewNote — Performance Indexes
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to run multiple times (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════

-- ── user_ratings ──
-- ReviewsForMedia: .eq("mediaId", N).not("review","is",null).neq("review","").eq("mediaType",...)
CREATE INDEX IF NOT EXISTS idx_user_ratings_media_review
  ON user_ratings("mediaId", "mediaType")
  WHERE review IS NOT NULL AND review <> '';

-- statsService: .eq("userId", ...).eq("mediaId", ...).eq("mediaType", ...)
CREATE INDEX IF NOT EXISTS idx_user_ratings_user_media
  ON user_ratings("userId", "mediaId", "mediaType");

-- TV scope queries: .eq("mediaId",...).eq("tvTargetType",...).eq("tvSeasonNumber",...)
CREATE INDEX IF NOT EXISTS idx_user_ratings_tv_scope
  ON user_ratings("mediaId", "tvTargetType", "tvSeasonNumber", "tvEpisodeNumber");

-- ── user_watched ──
-- mediaService: .eq("userId",...).eq("mediaId",...)
CREATE INDEX IF NOT EXISTS idx_user_watched_user_media
  ON user_watched("userId", "mediaId");

-- ── user_watchlist ──
-- useWatchlist: .eq("userId",...).eq("mediaId",...)
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_media
  ON user_watchlist("userId", "mediaId");

-- ── user_watching ──
-- mediaService: .eq("userId",...).eq("mediaId",...)
CREATE INDEX IF NOT EXISTS idx_user_watching_user_media
  ON user_watching("userId", "mediaId");

-- ── user_paused ──
CREATE INDEX IF NOT EXISTS idx_user_paused_user_media
  ON user_paused("userId", "mediaId");

-- ── user_dropped ──
CREATE INDEX IF NOT EXISTS idx_user_dropped_user_media
  ON user_dropped("userId", "mediaId");

-- ── favorites ──
-- useFavorites: .eq("userId",...).eq("mediaId",...).eq("mediaType",...)
CREATE INDEX IF NOT EXISTS idx_favorites_user_media
  ON favorites("userId", "mediaId", "mediaType");

-- Ordering: .eq("userId",...).eq("category",...).order("order")
CREATE INDEX IF NOT EXISTS idx_favorites_user_cat_order
  ON favorites("userId", category, "order");

-- ── user_series_progress ──
-- mediaService: .eq("userId",...).eq("seriesId",...)
CREATE INDEX IF NOT EXISTS idx_user_series_progress_user_series
  ON user_series_progress("userId", "seriesId");

-- ── review_likes ──
-- Batch like queries: .in("reviewDocId",[...])
-- Already has idx_review_likes_review on "reviewDocId"
-- Composite for user-specific like check:
CREATE INDEX IF NOT EXISTS idx_review_likes_review_user
  ON review_likes("reviewDocId", "userId");

-- ── review_comments ──
-- Batch comment count: .in("reviewDocId",[...])
-- Already has idx_review_comments_review on "reviewDocId"

-- ── user_follows ──
-- isFollowing: .eq("followerId",...).eq("followingId",...)
-- Already covered by UNIQUE("followerId","followingId") + individual indexes

-- ── media_stats ──
-- Already has idx_media_stats_media on ("mediaId","mediaType")

-- ── user_media_preferences ──
-- .eq("userId",...).eq("mediaId",...).eq("mediaType",...)
CREATE INDEX IF NOT EXISTS idx_user_media_prefs_user_media
  ON user_media_preferences("userId", "mediaId", "mediaType");

-- ── profiles ──
-- Username lookup (login, profile pages)
-- Already has UNIQUE on username and username_lowercase

-- ═══════════════════════════════════════════════════════════════════
-- ANALYZE tables after creating indexes (helps query planner)
-- ═══════════════════════════════════════════════════════════════════
ANALYZE user_ratings;
ANALYZE user_watched;
ANALYZE user_watchlist;
ANALYZE user_watching;
ANALYZE user_paused;
ANALYZE user_dropped;
ANALYZE favorites;
ANALYZE user_series_progress;
ANALYZE review_likes;
ANALYZE review_comments;
ANALYZE user_media_preferences;
