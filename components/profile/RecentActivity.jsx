"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl, getEpisodeUrl } from "@/lib/slugify";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import eventBus from "@/lib/eventBus";
import { Clock, Eye, Bookmark, Pause, XCircle, Star, RotateCcw, Film, Tv, Layers } from "lucide-react";

const ACTIVITY_LIMIT = 6; // 3×2 grid

const ACTIVITY_SOURCES = [
    { collection: "user_watched", timestampField: "addedAt", label: "Watched", icon: Eye, color: "text-green-400" },
    { collection: "user_ratings", timestampField: "ratedAt", label: "Rated", icon: Star, color: "text-accent" },
    { collection: "user_watchlist", timestampField: "addedAt", label: "Watchlist", icon: Bookmark, color: "text-blue-400" },
    { collection: "user_paused", timestampField: "pausedAt", label: "Paused", icon: Pause, color: "text-yellow-400" },
    { collection: "user_dropped", timestampField: "droppedAt", label: "Dropped", icon: XCircle, color: "text-red-400" },
];

export default function RecentActivity({ userId }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActivity = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        try {
            const promises = ACTIVITY_SOURCES.map(async (source) => {
                try {
                    let snap;
                    try {
                        const q = query(
                            collection(db, source.collection),
                            where("userId", "==", userId),
                            orderBy(source.timestampField, "desc"),
                            limit(ACTIVITY_LIMIT)
                        );
                        snap = await getDocs(q);
                    } catch {
                        // Fallback without orderBy if index missing
                        const q = query(
                            collection(db, source.collection),
                            where("userId", "==", userId),
                            limit(50)
                        );
                        snap = await getDocs(q);
                    }
                    return snap.docs.map((d) => {
                        const data = d.data();
                        const ts = data[source.timestampField]?.seconds || data.createdAt?.seconds || 0;
                        return {
                            id: d.id,
                            ...data,
                            activityType: source.label,
                            activityIcon: source.icon,
                            activityColor: source.color,
                            timestamp: ts,
                        };
                    });
                } catch {
                    return [];
                }
            });

            const results = await Promise.all(promises);
            const allItems = results.flat();

            // Sort by timestamp descending and deduplicate by mediaId+mediaType (keep most recent)
            allItems.sort((a, b) => b.timestamp - a.timestamp);
            const seen = new Set();
            const unique = [];
            for (const item of allItems) {
                const key = `${item.mediaType}_${item.mediaId}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(item);
                }
                if (unique.length >= ACTIVITY_LIMIT) break;
            }

            setActivities(unique);
        } catch (error) {
            console.error("Error fetching recent activity:", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    useEffect(() => {
        const handler = () => fetchActivity();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchActivity]);

    if (loading) {
        return (
            <div>
                <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-xl bg-secondary animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div>
                <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                <div className="text-center py-8">
                    <Clock size={48} className="mx-auto text-textSecondary mb-3 opacity-50" />
                    <p className="text-textSecondary text-sm">No recent activity yet</p>
                    <p className="text-xs text-textSecondary/60 mt-1">Start watching and rating to see your activity here</p>
                </div>
            </div>
        );
    }

    const formatTimeAgo = (seconds) => {
        if (!seconds) return "";
        const diff = Math.floor(Date.now() / 1000) - seconds;
        if (diff < 60) return "just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    return (
        <div>
            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {activities.map((item) => {
                    const IconComp = item.activityIcon;
                    // Use episode-aware routing
                    const isEpisode = item.mediaType === "episode" || (item.seasonNumber != null && item.episodeNumber != null);
                    const isSeason = item.targetType === "season" || (item.seasonNumber != null && item.episodeNumber == null && item.mediaType !== "episode");
                    const url = isEpisode
                        ? getEpisodeUrl(item)
                        : getMediaUrl(
                            { id: item.mediaId, title: item.title, name: item.title, mediaId: item.mediaId },
                            item.mediaType
                        );

                    // Poster priority: user custom → episode still → season poster → series poster → TMDB fallback
                    const posterUrl = item.customPoster
                        ? item.customPoster
                        : isEpisode && item.episodeStill
                            ? tmdb.getImageUrl(item.episodeStill, "w500")
                            : (isSeason || isEpisode) && item.seasonPoster
                                ? tmdb.getImageUrl(item.seasonPoster, "w500")
                                : item.poster_path
                                    ? tmdb.getImageUrl(item.poster_path)
                                    : null;

                    // Determine scope label
                    const scopeLabel = isEpisode
                        ? `S${item.seasonNumber || "?"}E${item.episodeNumber || "?"}`
                        : isSeason
                            ? `S${item.seasonNumber || "?"}`
                            : item.mediaType === "movie" ? "Movie" : item.mediaType === "tv" ? "Series" : "";

                    return (
                        <Link key={item.id} href={url} className="group">
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg bg-secondary group-hover:shadow-xl group-hover:shadow-accent/10 transition-all">
                                {posterUrl ? (
                                    <Image
                                        src={posterUrl}
                                        alt={item.title || item.name || "Media"}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 33vw, 16vw"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                        <span className="text-xs text-white/40 text-center px-2 line-clamp-3">{item.title || "No poster"}</span>
                                    </div>
                                )}
                                {/* Activity badge */}
                                <div className="absolute top-1.5 left-1.5">
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 ${item.activityColor}`}>
                                        <IconComp size={10} />
                                        <span className="text-[9px] font-bold uppercase">
                                            {item.isRewatch ? "Rewatch" : item.activityType}
                                        </span>
                                    </div>
                                </div>
                                {/* Scope tag (top-right) */}
                                {scopeLabel && (
                                    <div className="absolute top-1.5 right-1.5">
                                        <span className="px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-bold text-white/80">
                                            {scopeLabel}
                                        </span>
                                    </div>
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100">
                                    <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.title || item.name}</h4>
                                    <p className="text-[10px] text-white/60 mt-0.5">{formatTimeAgo(item.timestamp)}</p>
                                    {item.rating > 0 && (
                                        <div className="flex items-center gap-0.5 mt-0.5">
                                            <Star size={9} className="text-accent fill-accent" />
                                            <span className="text-[10px] text-accent font-bold">{item.rating}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
