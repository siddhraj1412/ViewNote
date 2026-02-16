"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star, Film, Tv } from "lucide-react";
import eventBus from "@/lib/eventBus";

const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_MAX_PX = 112; // h-28 = 7rem = 112px

export default function UserRatingDistribution({ userId }) {
    const [distribution, setDistribution] = useState({});
    const [totalRatings, setTotalRatings] = useState(0);
    const [averageRating, setAverageRating] = useState(0);
    const [movieCount, setMovieCount] = useState(0);
    const [tvCount, setTvCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hoverBucket, setHoverBucket] = useState(null);

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
            let movies = 0;
            let shows = 0;

            snap.docs.forEach((d) => {
                const data = d.data();
                const rating = Number(data.rating || 0);
                if (rating > 0 && rating <= 5) {
                    const rounded = Math.round(rating * 2) / 2;
                    if (dist[rounded] !== undefined) {
                        dist[rounded]++;
                    }
                    sum += rating;
                    count++;
                    if (data.mediaType === "movie") movies++;
                    else if (data.mediaType === "tv") shows++;
                }
            });

            setDistribution(dist);
            setTotalRatings(count);
            setAverageRating(count > 0 ? sum / count : 0);
            setMovieCount(movies);
            setTvCount(shows);
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

    // Compute pixel-based bar heights matching media page histogram style
    const bars = useMemo(() => {
        const max = Math.max(1, ...STAR_VALUES.map((b) => distribution[b] || 0));
        return STAR_VALUES.map((bucket) => {
            const count = distribution[bucket] || 0;
            const ratio = count / max;
            const heightPx = count === 0 ? 0 : Math.max(6, Math.round(ratio * BAR_MAX_PX));
            return { bucket, count, heightPx };
        });
    }, [distribution]);

    if (loading) {
        return (
            <div className="bg-secondary rounded-xl border border-white/5 p-5">
                <div className="h-5 w-40 bg-white/10 rounded animate-pulse mb-4" />
                <div className="h-32 bg-white/5 rounded animate-pulse" />
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            {/* Title */}
            <h3 className="text-lg font-bold text-white mb-1">Your Rating Distribution</h3>

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-sm text-textSecondary">
                    {totalRatings > 0 && (
                        <>
                            <div className="flex items-center gap-1.5">
                                <Star size={14} className="text-accent fill-accent" />
                                <span className="font-semibold text-white tabular-nums">
                                    {averageRating.toFixed(1)}
                                </span>
                                <span>avg</span>
                            </div>
                            <span className="text-white/20">·</span>
                        </>
                    )}
                    <span>{totalRatings} rating{totalRatings !== 1 ? "s" : ""}</span>
                </div>
            </div>

            {/* Scope breakdown pills */}
            {(movieCount > 0 || tvCount > 0) && (
                <div className="flex items-center gap-2 mb-4">
                    {movieCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-textSecondary">
                            <Film size={10} /> {movieCount} movie{movieCount !== 1 ? "s" : ""}
                        </span>
                    )}
                    {tvCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-textSecondary">
                            <Tv size={10} /> {tvCount} TV
                        </span>
                    )}
                </div>
            )}

            {/* Histogram bars — pixel-based heights for reliable rendering */}
            {totalRatings === 0 ? (
                <div className="h-28 flex items-center justify-center text-sm text-textSecondary/60">
                    No ratings yet — rate something to see your graph!
                </div>
            ) : (
                <div className="mt-2">
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
                    {/* Bucket labels */}
                    <div className="flex gap-1.5 mt-1">
                        {STAR_VALUES.map((val) => (
                            <div key={val} className="flex-1 text-center">
                                <span className="text-[9px] text-textSecondary tabular-nums">
                                    {val % 1 === 0 ? val : ""}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
