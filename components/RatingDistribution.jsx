"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { Eye, Heart, MessageSquare, Star } from "lucide-react";

function bucketFromRating(rating) {
    if (rating == null) return null;
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = Math.round(n * 2) / 2;
    const clamped = Math.max(0.5, Math.min(5, rounded));
    return clamped;
}

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function RatingDistribution({ mediaId, mediaType = null, statsId = null }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState(() => Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
    const [totalRatings, setTotalRatings] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [totalWatchers, setTotalWatchers] = useState(0);
    const [hoverBucket, setHoverBucket] = useState(null);
    const [totalLikes, setTotalLikes] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);

    const statsKey = useMemo(() => {
        if (statsId) return String(statsId);
        if (!mediaType || mediaId == null) return null;
        if (mediaType === "movie") return `movie_${Number(mediaId)}`;
        if (mediaType === "tv") return `tv_${Number(mediaId)}`;
        return null;
    }, [mediaId, mediaType, statsId]);

    const statsRef = useMemo(() => {
        return statsKey ? doc(db, "media_stats", statsKey) : null;
    }, [statsKey]);

    const likeRef = useMemo(() => {
        if (!user?.uid || !statsKey) return null;
        return doc(db, "user_media_likes", `${user.uid}_${statsKey}`);
    }, [user?.uid, statsKey]);

    useEffect(() => {
        if (!statsKey) {
            setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
            setTotalRatings(0);
            setTotalReviews(0);
            setTotalWatchers(0);
            setTotalLikes(0);
            setLoading(false);
            return;
        }

        setLoading(true);
        if (!statsRef) {
            setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
            setTotalRatings(0);
            setTotalReviews(0);
            setTotalWatchers(0);
            setTotalLikes(0);
            setLoading(false);
            return;
        }

        const unsub = onSnapshot(statsRef, (statsSnap) => {
            if (statsSnap.exists()) {
                const data = statsSnap.data() || {};
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
            } else {
                setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
                setTotalRatings(0);
                setTotalReviews(0);
                setTotalWatchers(0);
                setTotalLikes(0);
            }
            setLoading(false);
        }, () => {
            setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
            setTotalRatings(0);
            setTotalReviews(0);
            setTotalWatchers(0);
            setTotalLikes(0);
            setLoading(false);
        });

        return () => {
            try { unsub(); } catch (_) {}
        };
    }, [statsKey, statsRef]);

    useEffect(() => {
        if (!likeRef) {
            setLiked(false);
            return;
        }

        const unsub = onSnapshot(likeRef, (snap) => {
            setLiked(snap.exists());
        }, () => {
            setLiked(false);
        });

        return () => {
            try { unsub(); } catch (_) {}
        };
    }, [likeRef]);

    const handleToggleLike = async () => {
        if (!user?.uid || !statsRef || !likeRef || !statsKey) return;
        if (likeLoading) return;

        setLikeLoading(true);
        try {
            await runTransaction(db, async (tx) => {
                const likeSnap = await tx.get(likeRef);
                const statsSnap = await tx.get(statsRef);
                const statsData = statsSnap.exists() ? (statsSnap.data() || {}) : {};
                const prevLikes = Number(statsData.totalLikes || 0);

                if (likeSnap.exists()) {
                    tx.delete(likeRef);
                    tx.set(
                        statsRef,
                        { totalLikes: Math.max(0, prevLikes - 1) },
                        { merge: true }
                    );
                    return;
                }

                tx.set(
                    likeRef,
                    {
                        userId: user.uid,
                        statsId: statsKey,
                        mediaId: mediaId != null ? Number(mediaId) : null,
                        mediaType: mediaType || null,
                        createdAt: serverTimestamp(),
                    },
                    { merge: true }
                );
                tx.set(statsRef, { totalLikes: prevLikes + 1 }, { merge: true });
            });
        } finally {
            setLikeLoading(false);
        }
    };

    const bars = useMemo(() => {
        const max = Math.max(1, ...BUCKETS.map((b) => counts[String(b)] || 0));
        return BUCKETS.map((bucket) => {
            const count = counts[String(bucket)] || 0;
            const rawPct = Math.round((count / max) * 100);
            const heightPct = count === 0 ? 0 : Math.max(4, rawPct);
            return { bucket, count, heightPct };
        });
    }, [counts]);

    if (loading) {
        return (
            <div className="bg-secondary rounded-xl border border-white/5 p-5">
                <div className="h-5 w-40 bg-white/10 rounded mb-4" />
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-3 bg-white/10 rounded" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            <div className="text-lg font-bold text-white">Ratings</div>

            <div className="mt-4 relative">
                <div className="h-28 flex items-end gap-2">
                    {bars.map((b) => (
                        <div
                            key={b.bucket}
                            className="relative flex-1 h-full"
                            onMouseEnter={() => setHoverBucket(b.bucket)}
                            onMouseLeave={() => setHoverBucket(null)}
                        >
                            {hoverBucket === b.bucket ? (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 border border-white/10 px-2 py-1 text-xs text-white z-10">
                                    <span className="font-semibold tabular-nums">{b.bucket}★</span>
                                    <span className="text-white/70"> • </span>
                                    <span className="tabular-nums">{b.count}</span>
                                </div>
                            ) : null}
                            <div className="w-full h-full rounded-md bg-white/10" style={{ minHeight: "1px" }}>
                                <div
                                    className="w-full bg-accent rounded-md"
                                    style={{ height: b.heightPct > 0 ? `${b.heightPct}%` : "0%", minHeight: b.count > 0 ? "8px" : "0px" }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Eye size={16} />
                    <span className="tabular-nums">{totalWatchers}</span>
                </div>
                <button
                    type="button"
                    onClick={handleToggleLike}
                    disabled={!user?.uid || likeLoading}
                    className="flex items-center gap-2 text-sm text-textSecondary hover:text-white transition-colors disabled:opacity-60"
                    aria-label={liked ? "Unlike" : "Like"}
                    title={liked ? "Unlike" : "Like"}
                >
                    <Heart
                        size={16}
                        className={liked ? "text-red-400" : "text-white/50"}
                        fill={liked ? "currentColor" : "none"}
                    />
                    <span className="tabular-nums">{totalLikes}</span>
                </button>
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <MessageSquare size={16} />
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
