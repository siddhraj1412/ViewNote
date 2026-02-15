"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { Clock, Eye, Heart, Star } from "lucide-react";
import eventBus from "@/lib/eventBus";

function bucketFromRating(rating) {
    if (rating == null) return null;
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = Math.round(n * 2) / 2;
    const clamped = Math.max(0.5, Math.min(5, rounded));
    return clamped;
}

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_MAX_PX = 112; // h-28 = 7rem = 112px

/**
 * Aggregates rating data from user_ratings for a given media,
 * then writes the result into the media_stats doc so onSnapshot fires.
 * Supports scope-aware stats: pass statsKey and scopeFilter to write
 * season/episode-specific stats.
 */
export async function aggregateAndWriteStats(mediaId, mediaType, statsKey = null, scopeFilter = {}) {
    if (!mediaId || !mediaType) return null;
    const key = statsKey || `${mediaType}_${String(mediaId)}`;
    const targetType = scopeFilter?.targetType || null;
    const seasonNumber = scopeFilter?.seasonNumber ?? null;
    const episodeNumber = scopeFilter?.episodeNumber ?? null;

    try {
        const ratingsQ = query(
            collection(db, "user_ratings"),
            where("mediaId", "==", Number(mediaId))
        );
        const ratingsSnap = await getDocs(ratingsQ);

        const ratingBuckets = Object.fromEntries(BUCKETS.map((b) => [String(b), 0]));
        let totalRatings = 0;
        let totalReviews = 0;
        let totalLikes = 0;

        ratingsSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.mediaType !== mediaType) return;

            // Scope filtering for TV
            if (mediaType === "tv" && targetType) {
                if (targetType === "series") {
                    // Only include series-level ratings (no tvTargetType or tvTargetType === "series")
                    if (data.tvTargetType && data.tvTargetType !== "series") return;
                } else if (targetType === "season" && seasonNumber != null) {
                    if (data.tvTargetType !== "season" || data.tvSeasonNumber !== seasonNumber) return;
                } else if (targetType === "episode" && seasonNumber != null && episodeNumber != null) {
                    if (data.tvTargetType !== "episode" || data.tvSeasonNumber !== seasonNumber || data.tvEpisodeNumber !== episodeNumber) return;
                }
            }

            const r = Number(data.rating);
            if (!Number.isFinite(r) || r <= 0 || r > 5) return; // Reject zero and invalid ratings

            const bucket = bucketFromRating(r);
            if (bucket !== null) {
                ratingBuckets[String(bucket)] = (ratingBuckets[String(bucket)] || 0) + 1;
                totalRatings++;
            }
            if (data.review && data.review.trim().length > 0) {
                totalReviews++;
            }
            if (data.liked === true) {
                totalLikes++;
            }
        });

        const watchedQ = query(
            collection(db, "user_watched"),
            where("mediaId", "==", Number(mediaId))
        );
        const watchedSnap = await getDocs(watchedQ);
        const totalWatchers = watchedSnap.docs.filter((d) => d.data().mediaType === mediaType).length;

        const statsData = {
            ratingBuckets,
            totalRatings,
            totalReviews,
            totalWatchers,
            totalLikes,
            lastUpdated: serverTimestamp(),
        };

        const statsRef = doc(db, "media_stats", key);
        await setDoc(statsRef, statsData, { merge: true });

        if (process.env.NODE_ENV === "development") {
            console.log(`[RatingDistribution] Stats refreshed for ${key}:`, {
                totalRatings, totalReviews, totalWatchers, totalLikes,
                buckets: ratingBuckets,
            });
        }

        return statsData;
    } catch (error) {
        console.error(`[RatingDistribution] Error aggregating stats:`, error);
        return null;
    }
}

export default function RatingDistribution({ mediaId, mediaType = null, statsId = null }) {
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState(() => Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
    const [totalRatings, setTotalRatings] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [totalWatchers, setTotalWatchers] = useState(0);
    const [hoverBucket, setHoverBucket] = useState(null);
    const [totalLikes, setTotalLikes] = useState(0);
    const aggregatedRef = useRef(false);

    const statsKey = useMemo(() => {
        if (statsId) return String(statsId);
        if (mediaType && mediaId != null) return `${mediaType}_${String(mediaId)}`;
        return null;
    }, [statsId, mediaType, mediaId]);

    // Derive scope filter from statsId so aggregation queries the right ratings
    const scopeFilter = useMemo(() => {
        if (!mediaType || mediaType !== "tv") return {};
        const s = statsId ? String(statsId) : `${mediaType}_${String(mediaId)}`;
        // Episode pattern: tv_12345_s1e3
        const epMatch = s.match(/_s(\d+)e(\d+)$/);
        if (epMatch) return { targetType: "episode", seasonNumber: Number(epMatch[1]), episodeNumber: Number(epMatch[2]) };
        // Season pattern: tv_12345_season_1
        const snMatch = s.match(/_season_(\d+)$/);
        if (snMatch) return { targetType: "season", seasonNumber: Number(snMatch[1]) };
        // Series level (default statsId = tv_12345) — only show series-level ratings
        return { targetType: "series" };
    }, [statsId, mediaType, mediaId]);

    const applyStatsData = useCallback((data) => {
        const next = Object.fromEntries(BUCKETS.map((b) => [String(b), 0]));
        const buckets = data.ratingBuckets || data.buckets || {};
        for (const b of BUCKETS) {
            const key = String(b);
            next[key] = Number(buckets[key] || 0);
        }
        setCounts(next);
        setTotalRatings(Number(data.totalRatings || 0));
        setTotalReviews(Number(data.totalReviews || 0));
        setTotalWatchers(Number(data.totalWatchers || 0));
        setTotalLikes(Number(data.totalLikes || 0));
    }, []);

    const resetStats = useCallback(() => {
        setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
        setTotalRatings(0);
        setTotalReviews(0);
        setTotalWatchers(0);
        setTotalLikes(0);
    }, []);

    // Listen to media_stats in real time
    useEffect(() => {
        if (!statsKey) {
            resetStats();
            setLoading(false);
            return;
        }

        setLoading(true);
        aggregatedRef.current = false;
        const statsRef = doc(db, "media_stats", statsKey);

        const unsub = onSnapshot(statsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                applyStatsData(data);

                // If ratingBuckets missing or empty, trigger one-time aggregation
                const buckets = data.ratingBuckets || data.buckets || {};
                const hasData = BUCKETS.some((b) => Number(buckets[String(b)] || 0) > 0);
                if (!hasData && !aggregatedRef.current && mediaId && mediaType) {
                    aggregatedRef.current = true;
                    aggregateAndWriteStats(mediaId, mediaType, statsKey, scopeFilter);
                }
            } else {
                resetStats();
                // No stats doc — seed it via aggregation
                if (!aggregatedRef.current && mediaId && mediaType) {
                    aggregatedRef.current = true;
                    aggregateAndWriteStats(mediaId, mediaType, statsKey, scopeFilter);
                }
            }
            setLoading(false);
        }, () => {
            resetStats();
            setLoading(false);
        });

        return () => {
            try { unsub(); } catch (_) {}
        };
    }, [statsKey, mediaId, mediaType, scopeFilter, applyStatsData, resetStats]);

    // Re-aggregate whenever a rating or status change event fires for this media
    useEffect(() => {
        if (!mediaId || !mediaType) return;

        const handleUpdate = (data) => {
            if (String(data.mediaId) === String(mediaId) && data.mediaType === mediaType) {
                aggregateAndWriteStats(mediaId, mediaType, statsKey, scopeFilter);
            }
        };

        eventBus.on("MEDIA_UPDATED", handleUpdate);
        return () => eventBus.off("MEDIA_UPDATED", handleUpdate);
    }, [mediaId, mediaType, statsKey, scopeFilter]);

    // Compute bar heights in pixels so they always render correctly
    const bars = useMemo(() => {
        const max = Math.max(1, ...BUCKETS.map((b) => counts[String(b)] || 0));
        return BUCKETS.map((bucket) => {
            const count = counts[String(bucket)] || 0;
            const ratio = count / max;
            const heightPx = count === 0 ? 0 : Math.max(6, Math.round(ratio * BAR_MAX_PX));
            return { bucket, count, heightPx };
        });
    }, [counts]);

    const avgRating = useMemo(() => {
        let sum = 0;
        let total = 0;
        for (const b of BUCKETS) {
            const c = counts[String(b)] || 0;
            sum += b * c;
            total += c;
        }
        return total > 0 ? (sum / total).toFixed(1) : null;
    }, [counts]);

    if (loading) {
        return (
            <div className="bg-secondary rounded-xl border border-white/5 p-5">
                <div className="h-5 w-40 bg-white/10 rounded mb-4 animate-pulse" />
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-3 bg-white/10 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-white">Ratings</div>
                {avgRating && (
                    <div className="flex items-center gap-1.5 text-sm">
                        <Star size={14} className="text-accent" fill="currentColor" />
                        <span className="font-semibold text-white tabular-nums">{avgRating}</span>
                    </div>
                )}
            </div>

            {/* Histogram bars — pixel-based heights for reliable rendering */}
            <div className="mt-4">
                <div className="h-28 flex items-end gap-1.5">
                    {bars.map((b) => (
                        <div
                            key={b.bucket}
                            className="flex-1 relative group cursor-pointer"
                            onMouseEnter={() => setHoverBucket(b.bucket)}
                            onMouseLeave={() => setHoverBucket(null)}
                        >
                            {/* Tooltip */}
                            {hoverBucket === b.bucket && b.count > 0 && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 border border-white/10 px-2.5 py-1 text-xs text-white z-10 pointer-events-none">
                                    <span className="font-semibold tabular-nums">{b.bucket}★</span>
                                    <span className="text-white/70"> • </span>
                                    <span className="tabular-nums">{b.count}</span>
                                </div>
                            )}
                            {/* Background track — only show when bucket has ratings */}
                            {b.count > 0 && (
                                <>
                                    <div
                                        className="w-full rounded-sm bg-white/[0.06]"
                                        style={{ height: `${BAR_MAX_PX}px` }}
                                    />
                                    {/* Filled bar anchored to bottom */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-300 bg-accent group-hover:bg-accent/90"
                                        style={{ height: `${b.heightPx}px` }}
                                    />
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats row — Eye, Heart, Clock, Star all in one aligned row */}
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Eye size={16} />
                    <span className="tabular-nums">{totalWatchers}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Heart size={16} className={totalLikes > 0 ? "text-red-400" : ""} fill={totalLikes > 0 ? "currentColor" : "none"} />
                    <span className="tabular-nums">{totalLikes}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Clock size={16} />
                    <span className="tabular-nums">{totalReviews}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Star size={16} className="text-accent" fill="currentColor" />
                    <span className="tabular-nums">{totalRatings}</span>
                </div>
            </div>
        </div>
    );
}
