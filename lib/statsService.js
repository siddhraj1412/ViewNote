/**
 * Stats aggregation service — calculates and writes media stats.
 * Extracted from RatingDistribution to prevent circular imports
 * (mediaService → component → service).
 */
import supabase from "@/lib/supabase";

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function bucketFromRating(rating) {
    if (rating == null) return null;
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = Math.round(n * 2) / 2;
    return Math.max(0.5, Math.min(5, rounded));
}

/**
 * Aggregates rating data from user_ratings for a given media,
 * then writes the result into media_stats so realtime subscriptions fire.
 * Supports scope-aware stats for season/episode.
 */
export async function aggregateAndWriteStats(mediaId, mediaType, statsKey = null, scopeFilter = {}) {
    if (!mediaId || !mediaType) return null;
    const key = statsKey || `${mediaType}_${String(mediaId)}`;
    const targetType = scopeFilter?.targetType || null;
    const seasonNumber = scopeFilter?.seasonNumber ?? null;
    const episodeNumber = scopeFilter?.episodeNumber ?? null;

    try {
        // Fetch only the columns we need instead of SELECT *
        const { data: ratingsRaw, error: ratingsError } = await supabase
            .from("user_ratings")
            .select("rating, mediaType, tvTargetType, tvSeasonNumber, tvEpisodeNumber, review, liked")
            .eq("mediaId", Number(mediaId));
        if (ratingsError) throw ratingsError;

        const ratingBuckets = Object.fromEntries(BUCKETS.map((b) => [String(b), 0]));
        let totalRatings = 0;
        let totalReviews = 0;
        let totalLikes = 0;
        let ratingSum = 0;

        (ratingsRaw || []).forEach((data) => {
            if (data.mediaType !== mediaType) return;

            // Scope filtering for TV
            if (mediaType === "tv" && targetType) {
                if (targetType === "series") {
                    if (data.tvTargetType && data.tvTargetType !== "series") return;
                } else if (targetType === "season" && seasonNumber != null) {
                    if (data.tvTargetType !== "season" || data.tvSeasonNumber !== seasonNumber) return;
                } else if (targetType === "episode" && seasonNumber != null && episodeNumber != null) {
                    if (data.tvTargetType !== "episode" || data.tvSeasonNumber !== seasonNumber || data.tvEpisodeNumber !== episodeNumber) return;
                }
            }

            const r = Number(data.rating);
            if (!Number.isFinite(r) || r <= 0 || r > 5) return;

            const bucket = bucketFromRating(r);
            if (bucket !== null) {
                ratingBuckets[String(bucket)] = (ratingBuckets[String(bucket)] || 0) + 1;
                totalRatings++;
                ratingSum += r;
            }
            if (data.review && data.review.trim().length > 0) totalReviews++;
            if (data.liked === true) totalLikes++;
        });

        // Only fetch watched count (not full rows)
        const { count: totalWatchers } = await supabase
            .from("user_watched")
            .select("id", { count: "exact", head: true })
            .eq("mediaId", Number(mediaId))
            .eq("mediaType", mediaType);

        // Use column names matching the actual DB schema:
        // ratingDistribution (JSONB) stores buckets + extra counters
        // ratingCount (INT), avgRating (REAL), updatedAt (TIMESTAMPTZ)
        const avgRating = totalRatings > 0 ? parseFloat((ratingSum / totalRatings).toFixed(2)) : 0;

        await supabase
            .from("media_stats")
            .upsert({
                id: key,
                "mediaId": Number(mediaId),
                "mediaType": mediaType,
                "ratingCount": totalRatings,
                "avgRating": avgRating,
                "ratingDistribution": {
                    buckets: ratingBuckets,
                    totalReviews,
                    totalWatchers: totalWatchers || 0,
                    totalLikes,
                },
                "updatedAt": new Date().toISOString(),
            });

        return { ratingBuckets, totalRatings, totalReviews, totalWatchers: totalWatchers || 0, totalLikes, avgRating };
    } catch (error) {
        console.error(`[statsService] Error aggregating stats for ${key}:`, error);
        return null;
    }
}
