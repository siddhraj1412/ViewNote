"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star } from "lucide-react";
import eventBus from "@/lib/eventBus";

const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function UserRatingDistribution({ userId }) {
    const [distribution, setDistribution] = useState({});
    const [totalRatings, setTotalRatings] = useState(0);
    const [averageRating, setAverageRating] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchDistribution = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("userId", "==", userId)
            );
            const snap = await getDocs(q);
            const dist = {};
            STAR_VALUES.forEach((v) => { dist[v] = 0; });
            let sum = 0;
            let count = 0;

            snap.docs.forEach((d) => {
                const data = d.data();
                const rating = Number(data.rating || 0);
                if (rating > 0 && rating <= 5) {
                    // Round to nearest 0.5
                    const rounded = Math.round(rating * 2) / 2;
                    if (dist[rounded] !== undefined) {
                        dist[rounded]++;
                    }
                    sum += rating;
                    count++;
                }
            });

            setDistribution(dist);
            setTotalRatings(count);
            setAverageRating(count > 0 ? sum / count : 0);
        } catch (e) {
            console.error("Error fetching rating distribution:", e);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchDistribution();
    }, [fetchDistribution]);

    useEffect(() => {
        const handler = () => fetchDistribution();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchDistribution]);

    const maxCount = useMemo(() => {
        return Math.max(1, ...Object.values(distribution));
    }, [distribution]);

    if (loading) {
        return (
            <div className="bg-secondary rounded-xl border border-white/5 p-5">
                <div className="h-5 w-40 bg-white/10 rounded animate-pulse mb-4" />
                <div className="h-32 bg-white/5 rounded animate-pulse" />
            </div>
        );
    }

    if (totalRatings === 0) return null;

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Rating Distribution</h3>
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                    <Star size={14} className="text-accent fill-accent" />
                    <span className="font-semibold text-white tabular-nums">
                        {averageRating.toFixed(1)}
                    </span>
                    <span>avg · {totalRatings} rating{totalRatings !== 1 ? "s" : ""}</span>
                </div>
            </div>

            <div className="flex items-end gap-1 h-28">
                {STAR_VALUES.map((val) => {
                    const count = distribution[val] || 0;
                    const heightPct = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4;
                    return (
                        <div
                            key={val}
                            className="flex-1 flex flex-col items-center gap-1"
                        >
                            {count > 0 && (
                                <span className="text-[9px] text-textSecondary tabular-nums">{count}</span>
                            )}
                            <div
                                className={`w-full rounded-t transition-all ${
                                    count > 0 ? "bg-accent/80" : "bg-white/5"
                                }`}
                                style={{ height: `${heightPct}%` }}
                                title={`${val} stars: ${count} rating${count !== 1 ? "s" : ""}`}
                            />
                            <span className="text-[9px] text-textSecondary tabular-nums">
                                {val % 1 === 0 ? val : ""}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
