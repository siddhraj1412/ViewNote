"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl, getEpisodeUrl } from "@/lib/slugify";
import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";
import { Clock, Eye, Bookmark, Pause, XCircle, Star, Film, Tv } from "lucide-react";

const ACTIVITY_LIMIT = 6; // 6 × 1 row

const ACTIVITY_SOURCES = [
    { collection: "user_watched", timestampField: "addedAt", label: "Watched", icon: Eye, color: "text-green-400" },
    { collection: "user_ratings", timestampField: "ratedAt", label: "Rated", icon: Star, color: "text-accent" },
    { collection: "user_watchlist", timestampField: "addedAt", label: "Watchlist", icon: Bookmark, color: "text-blue-400" },
    { collection: "user_paused", timestampField: "pausedAt", label: "Paused", icon: Pause, color: "text-yellow-400" },
    { collection: "user_dropped", timestampField: "droppedAt", label: "Dropped", icon: XCircle, color: "text-red-400" },
];

/**
 * Fetch per-user custom poster/banner map from user_media_preferences.
 * Returns: { "movie_123": { customPoster, customBanner }, ... }
 */
async function fetchCustomizationsMap(userId) {
    if (!userId) return {};
    try {
        const { data, error } = await supabase
            .from("user_media_preferences")
            .select('"mediaType", "mediaId", "customPoster", "customBanner"')
            .eq("userId", userId);
        if (error || !data) return {};
        const map = {};
        data.forEach(row => {
            map[`${row.mediaType}_${row.mediaId}`] = {
                customPoster: row.customPoster,
                customBanner: row.customBanner,
            };
        });
        return map;
    } catch {
        return {};
    }
}

/**
 * Fetch season poster from TMDB via server proxy for season-level ratings.
 * Returns poster path string or null.
 */
async function fetchSeasonPoster(seriesId, seasonNumber) {
    if (!seriesId || seasonNumber == null) return null;
    try {
        const res = await fetch(
            `/api/tmdb?endpoint=${encodeURIComponent(`tv/${seriesId}/season/${seasonNumber}`)}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.poster_path || null;
    } catch {
        return null;
    }
}

/**
 * Fetch episode still from TMDB via server proxy for episode-level ratings.
 */
async function fetchEpisodeStill(seriesId, seasonNumber, episodeNumber) {
    if (!seriesId || seasonNumber == null || episodeNumber == null) return null;
    try {
        const res = await fetch(
            `/api/tmdb?endpoint=${encodeURIComponent(`tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`)}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return {
            still_path: data.still_path || null,
            name: data.name || null,
            poster_path: null,
        };
    } catch {
        return null;
    }
}

export default function RecentActivity({ userId }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActivity = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Fetch user customizations in parallel with activity
            const [customizationsMap, ...activityResults] = await Promise.all([
                fetchCustomizationsMap(userId),
                ...ACTIVITY_SOURCES.map(async (source) => {
                    try {
                        const { data } = await supabase
                            .from(source.collection)
                            .select("*")
                            .eq("userId", userId)
                            .order(source.timestampField, { ascending: false })
                            .limit(ACTIVITY_LIMIT);

                        return (data || []).map((row) => {
                            const ts = row[source.timestampField]
                                ? Math.floor(new Date(row[source.timestampField]).getTime() / 1000)
                                : row.createdAt
                                    ? Math.floor(new Date(row.createdAt).getTime() / 1000)
                                    : 0;
                            return {
                                ...row,
                                activityType: source.label,
                                activityIcon: source.icon,
                                activityColor: source.color,
                                timestamp: ts,
                            };
                        });
                    } catch {
                        return [];
                    }
                }),
            ]);

            const allItems = activityResults.flat();

            // Sort by timestamp descending and deduplicate
            allItems.sort((a, b) => b.timestamp - a.timestamp);
            const seen = new Set();
            const unique = [];
            for (const item of allItems) {
                // For ratings, use scoped key (series vs season vs episode)
                const scopeKey = item.tvTargetType
                    ? `${item.mediaType}_${item.mediaId}_${item.tvTargetType}_${item.tvSeasonNumber || ""}_${item.tvEpisodeNumber || ""}`
                    : `${item.mediaType}_${item.mediaId}`;
                if (!seen.has(scopeKey)) {
                    seen.add(scopeKey);
                    unique.push(item);
                }
                if (unique.length >= ACTIVITY_LIMIT) break;
            }

            // Enrich items with custom posters + season/episode data from TMDB
            const enriched = await Promise.all(
                unique.map(async (item) => {
                    const isSeason = item.tvTargetType === "season" && item.tvSeasonNumber != null;
                    const isEpisode = item.tvTargetType === "episode" && item.tvSeasonNumber != null && item.tvEpisodeNumber != null;
                    const seriesId = item.seriesId || item.mediaId;

                    // Attach custom poster from user_media_preferences
                    const customKey = `${item.mediaType}_${item.mediaId}`;
                    const custom = customizationsMap[customKey];
                    const enrichedItem = custom
                        ? { ...item, _customPoster: custom.customPoster || null, _customBanner: custom.customBanner || null }
                        : item;

                    if (isSeason && !enrichedItem._seasonPoster) {
                        const posterPath = await fetchSeasonPoster(seriesId, enrichedItem.tvSeasonNumber);
                        if (posterPath) {
                            return { ...enrichedItem, _seasonPoster: posterPath };
                        }
                    }
                    if (isEpisode && !enrichedItem._episodeStill) {
                        const [epData, seasonPoster] = await Promise.all([
                            fetchEpisodeStill(seriesId, enrichedItem.tvSeasonNumber, enrichedItem.tvEpisodeNumber),
                            fetchSeasonPoster(seriesId, enrichedItem.tvSeasonNumber),
                        ]);
                        return {
                            ...enrichedItem,
                            _episodeStill: epData?.still_path || null,
                            _episodeName: epData?.name || null,
                            _seasonPoster: seasonPoster || null,
                        };
                    }
                    return enrichedItem;
                })
            );

            setActivities(enriched);
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
                <div className="grid grid-cols-6 gap-3">
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
            {/* 6 × 1 grid — always 6 items in one row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {activities.map((item) => {
                    const IconComp = item.activityIcon;
                    const isSeason = item.tvTargetType === "season" && item.tvSeasonNumber != null;
                    const isEpisode = item.tvTargetType === "episode" && item.tvSeasonNumber != null && item.tvEpisodeNumber != null;

                    // URL routing
                    const url = isEpisode
                        ? getEpisodeUrl(item)
                        : getMediaUrl(
                            { id: item.mediaId, title: item.title, name: item.title, mediaId: item.mediaId },
                            item.mediaType
                        );

                    // Poster priority:
                    // 1. User's custom poster (from user_media_preferences)
                    // 2. Episode: season poster → series poster → fallback
                    // 3. Season: season poster → series poster → fallback
                    // 4. Movie/Series: poster_path → fallback
                    let posterUrl = null;
                    if (item._customPoster) {
                        posterUrl = item._customPoster.startsWith("http")
                            ? item._customPoster
                            : tmdb.getImageUrl(item._customPoster);
                    } else if (isEpisode) {
                        posterUrl = item._seasonPoster
                            ? tmdb.getImageUrl(item._seasonPoster)
                            : item.poster_path
                                ? tmdb.getImageUrl(item.poster_path)
                                : null;
                    } else if (isSeason) {
                        posterUrl = item._seasonPoster
                            ? tmdb.getImageUrl(item._seasonPoster)
                            : item.poster_path
                                ? tmdb.getImageUrl(item.poster_path)
                                : null;
                    } else {
                        posterUrl = item.poster_path
                            ? tmdb.getImageUrl(item.poster_path)
                            : null;
                    }

                    // Scope label
                    const scopeLabel = isEpisode
                        ? `S${item.tvSeasonNumber}E${item.tvEpisodeNumber}`
                        : isSeason
                            ? `Season ${item.tvSeasonNumber}`
                            : item.mediaType === "movie" ? "Movie" : item.mediaType === "tv" ? "Series" : "";

                    // Season/episode name for hover
                    const subTitle = isEpisode
                        ? item._episodeName || `Episode ${item.tvEpisodeNumber}`
                        : isSeason
                            ? `Season ${item.tvSeasonNumber}`
                            : "";

                    return (
                        <Link key={`${item.activityType}_${item.mediaType}_${item.id}`} href={url} className="group">
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
                                        {item.mediaType === "movie" ? (
                                            <Film size={24} className="text-white/20" />
                                        ) : (
                                            <Tv size={24} className="text-white/20" />
                                        )}
                                    </div>
                                )}

                                {/* Activity badge — top left */}
                                <div className="absolute top-1.5 left-1.5">
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 ${item.activityColor}`}>
                                        <IconComp size={10} />
                                        <span className="text-[9px] font-bold uppercase">
                                            {item.isRewatch ? "Rewatch" : item.activityType}
                                        </span>
                                    </div>
                                </div>

                                {/* Scope tag — top right */}
                                {scopeLabel && (
                                    <div className="absolute top-1.5 right-1.5">
                                        <span className="px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-bold text-white/80">
                                            {scopeLabel}
                                        </span>
                                    </div>
                                )}

                                {/* Rating badge — bottom left (always visible) */}
                                {item.rating > 0 && (
                                    <div className="absolute bottom-1.5 left-1.5">
                                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                                            <Star size={10} className="text-accent fill-accent" />
                                            <span className="text-[10px] text-accent font-bold">{item.rating}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Hover overlay — expanded info */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/70 transition-colors flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100">
                                    <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                                        {item.title || item.name}
                                    </h4>
                                    {subTitle && (
                                        <p className="text-[10px] text-accent/80 font-medium mt-0.5 line-clamp-1">{subTitle}</p>
                                    )}
                                    <p className="text-[10px] text-white/60 mt-0.5">{formatTimeAgo(item.timestamp)}</p>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
