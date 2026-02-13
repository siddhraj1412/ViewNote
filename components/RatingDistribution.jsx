"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";

function bucketFromRating(rating) {
    if (!rating || rating <= 0) return null;
    const rounded = Math.floor(rating + 0.5);
    return Math.max(1, Math.min(5, rounded));
}

export default function RatingDistribution({ mediaId }) {
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!mediaId) {
                setCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
                setTotal(0);
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

                const next = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                let t = 0;

                for (const d of snap.docs) {
                    const data = d.data();
                    const b = bucketFromRating(data.rating);
                    if (!b) continue;
                    next[b] = (next[b] || 0) + 1;
                    t += 1;
                }

                if (!cancelled) {
                    setCounts(next);
                    setTotal(t);
                }
            } catch {
                if (!cancelled) {
                    setCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
                    setTotal(0);
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
        return [5, 4, 3, 2, 1].map((star) => {
            const c = counts[star] || 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return { star, count: c, pct };
        });
    }, [counts, total]);

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

    if (total === 0) {
        return (
            <div className="bg-secondary rounded-xl border border-white/5 p-5">
                <div className="text-lg font-bold text-white mb-2">Rating distribution</div>
                <div className="text-sm text-textSecondary">No one has rated this movie yet. Be the first one.</div>
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-bold text-white">Rating distribution</div>
                <div className="text-xs text-textSecondary">{total} rating{total !== 1 ? "s" : ""}</div>
            </div>

            <div className="space-y-2">
                {rows.map((r) => (
                    <div key={r.star} className="flex items-center gap-3">
                        <div className="w-10 text-xs font-semibold text-white">{r.star}★</div>
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full bg-accent"
                                style={{ width: `${r.pct}%` }}
                            />
                        </div>
                        <div className="w-14 text-right text-xs text-textSecondary">{r.pct}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
