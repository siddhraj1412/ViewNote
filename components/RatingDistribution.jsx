"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Clock, Eye, Star } from "lucide-react";

function bucketFromRating(rating) {
    if (rating == null) return null;
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = Math.round(n * 2) / 2;
    const clamped = Math.max(0.5, Math.min(5, rounded));
    return clamped;
}

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function RatingDistribution({ mediaId, mediaType = null }) {
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState(() => Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
    const [totalRatings, setTotalRatings] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [totalWatchers, setTotalWatchers] = useState(0);
    const [hoverBucket, setHoverBucket] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!mediaId) {
                setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
                setTotalRatings(0);
                setTotalReviews(0);
                setTotalWatchers(0);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const statsKey = mediaType && mediaId != null ? `${mediaType}_${String(mediaId)}` : null;
                const statsRef = statsKey ? doc(db, "media_stats", statsKey) : null;

                if (statsRef) {
                    const statsSnap = await getDoc(statsRef);
                    if (statsSnap.exists()) {
                        const data = statsSnap.data() || {};
                        const next = Object.fromEntries(BUCKETS.map((b) => [String(b), 0]));
                        const buckets = data.ratingBuckets || data.buckets || {};
                        for (const b of BUCKETS) {
                            const key = String(b);
                            next[key] = Number(buckets[key] || 0);
                        }

                        if (!cancelled) {
                            setCounts(next);
                            setTotalRatings(Number(data.totalRatings || 0));
                            setTotalReviews(Number(data.totalReviews || 0));
                            setTotalWatchers(Number(data.totalWatchers || 0));
                        }

                        setLoading(false);
                        return;
                    }
                }

                if (!cancelled) {
                    setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
                    setTotalRatings(0);
                    setTotalReviews(0);
                    setTotalWatchers(0);
                }
            } catch {
                if (!cancelled) {
                    setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
                    setTotalRatings(0);
                    setTotalReviews(0);
                    setTotalWatchers(0);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [mediaId]);

    const bars = useMemo(() => {
        const max = Math.max(1, ...BUCKETS.map((b) => counts[String(b)] || 0));
        return BUCKETS.map((bucket) => {
            const count = counts[String(bucket)] || 0;
            const heightPct = Math.round((count / max) * 100);
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
                            className="relative flex-1"
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
                            <div className="w-full rounded-md bg-white/10 overflow-hidden">
                                <div
                                    className="w-full bg-accent"
                                    style={{ height: `${b.heightPct}%` }}
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
