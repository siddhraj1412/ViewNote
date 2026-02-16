"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import eventBus from "@/lib/eventBus";
import { mediaService } from "@/services/mediaService";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star, Heart, MessageSquare, RotateCcw } from "lucide-react";

const PREVIEW_SIZE = 24;

// Render visual star icons (filled, half, empty) for a rating value
function renderStarIcons(rating, size = 10) {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.25 && rating % 1 <= 0.75;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    for (let i = 0; i < fullStars; i++) {
        stars.push(
            <Star key={`f${i}`} size={size} className="text-accent fill-accent" />
        );
    }
    if (hasHalf) {
        stars.push(
            <span key="half" className="relative inline-block" style={{ width: size, height: size }}>
                <Star size={size} className="absolute text-white/20" />
                <span className="absolute overflow-hidden" style={{ width: size / 2, height: size }}>
                    <Star size={size} className="text-accent fill-accent" />
                </span>
            </span>
        );
    }
    for (let i = 0; i < emptyStars; i++) {
        stars.push(
            <Star key={`e${i}`} size={size} className="text-white/20" />
        );
    }
    return <span className="flex items-center gap-px">{stars}</span>;
}

export default function WatchedSectionTab() {
    const { user } = useAuth();
    const params = useParams();
    const profileUserId = params?.id || user?.uid;
    const usernameParam = params?.username;

    const [watchedItems, setWatchedItems] = useState([]);
    const [ratingsMap, setRatingsMap] = useState({});
    const [filter, setFilter] = useState("all");
    const [starFilter, setStarFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest");
    const [loading, setLoading] = useState(true);

    const fetchWatched = useCallback(async () => {
        if (!profileUserId) return;
        setLoading(true);
        try {
            const data = await profileService.getWatched(profileUserId);
            setWatchedItems(data || []);
        } catch (e) {
            console.error("Error fetching watched:", e);
        } finally {
            setLoading(false);
        }
    }, [profileUserId]);

    // Fetch user ratings to build metadata map
    const fetchRatings = useCallback(async () => {
        if (!profileUserId) return;
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("userId", "==", profileUserId)
            );
            const snap = await getDocs(q);
            const map = {};
            snap.docs.forEach((d) => {
                const data = d.data();
                const key = `${data.mediaType}_${data.mediaId}`;
                // For series-level, use the base key
                if (!map[key] || (data.targetType || data.tvTargetType || "series") === "series") {
                    map[key] = {
                        rating: data.rating || 0,
                        liked: data.liked || false,
                        review: data.review || "",
                        viewCount: data.viewCount || (data.isRewatch ? 2 : 1),
                    };
                }
            });
            setRatingsMap(map);
        } catch (e) {
            console.error("Error fetching ratings:", e);
        }
    }, [profileUserId]);

    useEffect(() => {
        fetchWatched();
        fetchRatings();
    }, [fetchWatched, fetchRatings]);

    // Listen for media updates and snapshot events
    useEffect(() => {
        const handler = () => { fetchWatched(); fetchRatings(); };
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("WATCHED_SNAPSHOT", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("WATCHED_SNAPSHOT", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchWatched, fetchRatings]);

    // Attach realtime listener
    useEffect(() => {
        if (!profileUserId) return;
        const cleanup = mediaService.attachProfileListeners(profileUserId, (key, items) => {
            if (key === "watched") {
                setWatchedItems(items);
            }
        });
        return cleanup;
    }, [profileUserId]);

    const filteredItems = useMemo(() => {
        let items = watchedItems;
        if (filter === "movies") items = items.filter((i) => i.mediaType === "movie");
        else if (filter === "series") items = items.filter((i) => i.mediaType === "tv");

        if (starFilter !== "all") {
            const targetStar = Number(starFilter);
            items = items.filter((item) => {
                const key = `${item.mediaType}_${item.mediaId}`;
                const meta = ratingsMap[key];
                if (!meta) return targetStar === 0; // "Unrated" filter
                return Math.round(meta.rating * 2) / 2 === targetStar;
            });
        }

        // Sort
        const sorted = [...items];
        switch (sortBy) {
            case "oldest":
                sorted.sort((a, b) => (a.addedAt?.seconds || 0) - (b.addedAt?.seconds || 0));
                break;
            case "a-z":
                sorted.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
                break;
            case "z-a":
                sorted.sort((a, b) => (b.title || b.name || "").localeCompare(a.title || a.name || ""));
                break;
            case "rating-high":
                sorted.sort((a, b) => {
                    const rA = ratingsMap[`${a.mediaType}_${a.mediaId}`]?.rating || 0;
                    const rB = ratingsMap[`${b.mediaType}_${b.mediaId}`]?.rating || 0;
                    return rB - rA;
                });
                break;
            case "rating-low":
                sorted.sort((a, b) => {
                    const rA = ratingsMap[`${a.mediaType}_${a.mediaId}`]?.rating || 0;
                    const rB = ratingsMap[`${b.mediaType}_${b.mediaId}`]?.rating || 0;
                    return rA - rB;
                });
                break;
            case "newest":
            default:
                sorted.sort((a, b) => (b.addedAt?.seconds || 0) - (a.addedAt?.seconds || 0));
                break;
        }
        return sorted;
    }, [watchedItems, filter, starFilter, sortBy, ratingsMap]);

    const counts = {
        all: watchedItems.length,
        movies: watchedItems.filter((i) => i.mediaType === "movie").length,
        series: watchedItems.filter((i) => i.mediaType === "tv").length,
    };

    if (loading) {
        return <div className="text-center py-12 text-textSecondary">Loading watched...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {["all", "movies", "series"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                            filter === f
                                ? "bg-accent text-white"
                                : "bg-white/5 text-textSecondary hover:text-white"
                        }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                    </button>
                ))}
                <select
                    value={starFilter}
                    onChange={(e) => setStarFilter(e.target.value)}
                    className="bg-background text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                >
                    <option value="all">All Ratings</option>
                    {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((s) => (
                        <option key={s} value={s}>{"★".repeat(Math.floor(s))}{s % 1 ? "½" : ""} ({s})</option>
                    ))}
                    <option value="0">Unrated</option>
                </select>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-background text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="a-z">A → Z</option>
                    <option value="z-a">Z → A</option>
                    <option value="rating-high">Rating ↓</option>
                    <option value="rating-low">Rating ↑</option>
                </select>
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-textSecondary">
                    No watched items {starFilter !== "all" ? "with this rating" : "yet"}
                </div>
            ) : (
                <>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {filteredItems.slice(0, PREVIEW_SIZE).map((item) => {
                        const key = `${item.mediaType}_${item.mediaId}`;
                        const meta = ratingsMap[key];
                        return (
                            <Link
                                key={item.id}
                                href={getMediaUrl(item, item.mediaType)}
                                className="group"
                            >
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-all bg-secondary">
                                    <Image
                                        src={tmdb.getImageUrl(item.poster_path)}
                                        alt={item.title || item.name || "Media"}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                                        loading="lazy"
                                    />
                                    {/* Hover overlay with title + year */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col justify-end p-2.5 opacity-0 group-hover:opacity-100">
                                        <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.title || item.name}</h4>
                                        <p className="text-[10px] text-white/70 mt-0.5">
                                            {item.release_date?.split?.("-")?.[0] || item.first_air_date?.split?.("-")?.[0] || ""}
                                        </p>
                                        {meta?.rating > 0 && (
                                            <div className="flex items-center gap-0.5 mt-1">
                                                <Star size={10} className="text-accent fill-accent" />
                                                <span className="text-[10px] text-accent font-bold">{meta.rating}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Metadata indicators under poster */}
                                <div className="mt-1.5 flex items-center gap-1.5 min-h-[18px]">
                                    {meta?.rating > 0 && renderStarIcons(meta.rating, 10)}
                                    {meta?.liked && (
                                        <Heart size={10} className="text-red-400 fill-red-400" />
                                    )}
                                    {meta?.review && (
                                        <MessageSquare size={10} className="text-blue-400" />
                                    )}
                                    {meta?.viewCount > 1 && (
                                        <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                                            <RotateCcw size={9} />
                                            {meta.viewCount}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                    </div>
                    {filteredItems.length > PREVIEW_SIZE && usernameParam && (
                        <div className="flex justify-center mt-6">
                            <Link
                                href={`/${encodeURIComponent(usernameParam)}/watched`}
                                className="px-6 py-2.5 text-sm font-medium text-accent hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            >
                                See More ({filteredItems.length})
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
