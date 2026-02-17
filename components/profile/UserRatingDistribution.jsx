"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import supabase from "@/lib/supabase";
import { Star, Film, Tv, Layers, Play } from "lucide-react";
import eventBus from "@/lib/eventBus";

const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_MAX_PX = 112; // h-28 = 7rem = 112px

const SCOPE_FILTERS = [
    { key: "all", label: "All" },
    { key: "movie", label: "Movies" },
    { key: "tv", label: "Shows" },
    { key: "season", label: "Seasons" },
    { key: "episode", label: "Episodes" },
];

export default function UserRatingDistribution({ userId }) {
    const [allRatings, setAllRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoverBucket, setHoverBucket] = useState(null);
    const [scope, setScope] = useState("all");

    const fetchDistribution = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("userId", userId);

            const ratings = (data || []).map((row) => ({
                rating: Number(row.rating || 0),
                mediaType: row.mediaType || "movie",
                targetType: row.tvTargetType || null,
            })).filter((r) => r.rating > 0 && r.rating <= 5);

            setAllRatings(ratings);
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

    // Compute filtered data based on scope
    const { distribution, totalRatings, averageRating, movieCount, tvCount } = useMemo(() => {
        const filtered = scope === "all"
            ? allRatings
            : scope === "season"
                ? allRatings.filter((r) => r.targetType === "season")
                : scope === "episode"
                    ? allRatings.filter((r) => r.targetType === "episode" || r.mediaType === "episode")
                    : allRatings.filter((r) => r.mediaType === scope && r.targetType !== "season" && r.targetType !== "episode");

        const dist = {};
        STAR_VALUES.forEach((v) => { dist[v] = 0; });
        let sum = 0;
        let movies = 0;
        let shows = 0;

        filtered.forEach((r) => {
            const rounded = Math.round(r.rating * 2) / 2;
            if (dist[rounded] !== undefined) dist[rounded]++;
            sum += r.rating;
            if (r.mediaType === "movie") movies++;
            else if (r.mediaType === "tv") shows++;
        });

        return {
            distribution: dist,
            totalRatings: filtered.length,
            averageRating: filtered.length > 0 ? sum / filtered.length : 0,
            movieCount: movies,
            tvCount: shows,
        };
    }, [allRatings, scope]);

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

            {/* Scope filter buttons */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {SCOPE_FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setScope(f.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            scope === f.key
                                ? "bg-accent text-background"
                                : "bg-white/5 text-textSecondary hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Histogram bars — pixel-based heights for reliable rendering */}
            {totalRatings === 0 ? (
                <div className="h-28 flex items-center justify-center text-sm text-textSecondary/60">
                    No ratings yet - rate something to see your graph!
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
                                {/* Filled bar — only render when bucket has ratings */}
                                {b.count > 0 && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-300 bg-accent group-hover:bg-accent/90"
                                        style={{ height: `${b.heightPx}px` }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            )}
        </div>
    );
}
