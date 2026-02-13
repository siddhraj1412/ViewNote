"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { Star, Eye, MessageSquare } from "lucide-react";

function bucketFromRating(rating) {
    if (rating == null) return null;
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = Math.round(n * 2) / 2;
    const clamped = Math.max(0.5, Math.min(5, rounded));
    return clamped;
}

const BUCKETS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

export default function RatingDistribution({ mediaId }) {
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState(() => Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
    const [totalRatings, setTotalRatings] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [avg, setAvg] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!mediaId) {
                setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
                setTotalRatings(0);
                setTotalReviews(0);
                setAvg(0);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const q = query(
                    collection(db, "user_ratings"),
                    where("mediaId", "==", Number(mediaId)),
                    limit(2000)
                );
                const snap = await getDocs(q);

                const next = Object.fromEntries(BUCKETS.map((b) => [String(b), 0]));
                let ratingsTotal = 0;
                let reviewsTotal = 0;
                let sum = 0;

                for (const d of snap.docs) {
                    const data = d.data();
                    const b = bucketFromRating(data.rating);
                    if (!b) continue;
                    const key = String(b);
                    next[key] = (next[key] || 0) + 1;
                    ratingsTotal += 1;
                    sum += Number(b);
                    if (typeof data.review === "string" && data.review.trim().length > 0) {
                        reviewsTotal += 1;
                    }
                }

                if (!cancelled) {
                    setCounts(next);
                    setTotalRatings(ratingsTotal);
                    setTotalReviews(reviewsTotal);
                    setAvg(ratingsTotal > 0 ? sum / ratingsTotal : 0);
                }
            } catch {
                if (!cancelled) {
                    setCounts(Object.fromEntries(BUCKETS.map((b) => [String(b), 0])));
                    setTotalRatings(0);
                    setTotalReviews(0);
                    setAvg(0);
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

    const rows = useMemo(() => {
        return BUCKETS.map((star) => {
            const c = counts[String(star)] || 0;
            const pct = totalRatings > 0 ? Math.round((c / totalRatings) * 100) : 0;
            return { star, count: c, pct };
        });
    }, [counts, totalRatings]);

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

    if (totalRatings === 0) {
        return (
            <div className="bg-secondary rounded-xl border border-white/5 p-5">
                <div className="text-lg font-bold text-white mb-2">Rating distribution</div>
                <div className="text-sm text-textSecondary">No one has rated this yet. Be the first.</div>
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <div className="text-lg font-bold text-white">Rating distribution</div>
                    <div className="text-xs text-textSecondary">{totalRatings} rating{totalRatings !== 1 ? "s" : ""}</div>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Star size={16} className="text-accent" fill="currentColor" />
                        <div className="text-2xl font-bold text-white tabular-nums">{avg.toFixed(1)}</div>
                    </div>
                    <div className="text-xs text-textSecondary">Average</div>
                </div>
            </div>

            <div className="space-y-2">
                {rows.map((r) => (
                    <div key={r.star} className="flex items-center gap-3">
                        <div className="w-12 text-xs font-semibold text-white">{r.star}★</div>
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full bg-accent"
                                style={{ width: `${r.pct}%` }}
                            />
                        </div>
                        <div className="w-10 text-right text-xs text-textSecondary tabular-nums">{r.count}</div>
                        <div className="w-12 text-right text-xs text-textSecondary tabular-nums">{r.pct}%</div>
                    </div>
                ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Eye size={16} />
                    <span className="tabular-nums">{totalRatings}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <MessageSquare size={16} />
                    <span className="tabular-nums">{totalReviews}</span>
                </div>
            </div>
        </div>
    );
}
