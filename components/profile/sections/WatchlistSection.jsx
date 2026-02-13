"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Star, FileText, Repeat } from "lucide-react";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import eventBus from "@/lib/eventBus";
import { mediaService } from "@/services/mediaService";

export default function WatchlistSection({ userId }) {
    const { user } = useAuth();
    const params = useParams();
    const ownerId = userId || params?.id || user?.uid;

    const [watchlistItems, setWatchlistItems] = useState([]);
    const [ratingsByKey, setRatingsByKey] = useState({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    const fetchWatchlist = useCallback(async () => {
        if (!ownerId) return;
        setLoading(true);
        try {
            const data = await profileService.getWatchlist(ownerId);
            setWatchlistItems(data || []);
        } catch (e) {
            console.error("Error fetching watchlist:", e);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        fetchWatchlist();
    }, [fetchWatchlist]);

    useEffect(() => {
        const handler = () => fetchWatchlist();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("WATCHLIST_SNAPSHOT", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("WATCHLIST_SNAPSHOT", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchWatchlist]);

    // Attach realtime listener
    useEffect(() => {
        if (!ownerId) return;
        const cleanup = mediaService.attachProfileListeners(ownerId, (key, items) => {
            if (key === "watchlist") {
                setWatchlistItems(items);
            }
            if (key === "ratings") {
                const next = {};
                for (const r of items || []) {
                    const k = `${r.mediaType}_${r.mediaId}`;
                    next[k] = r;
                }
                setRatingsByKey(next);
            }
        });
        return cleanup;
    }, [ownerId]);

    const renderIndicators = (ratingDoc) => {
        if (!ratingDoc) return null;

        const hasRating = typeof ratingDoc.rating === "number" && ratingDoc.rating > 0;
        const hasLiked = ratingDoc.liked === true;
        const hasReview = typeof ratingDoc.review === "string" && ratingDoc.review.trim().length > 0;
        const viewCount = typeof ratingDoc.viewCount === "number" ? ratingDoc.viewCount : 1;
        const hasRewatch = viewCount > 1;

        if (!hasRating && !hasLiked && !hasReview && !hasRewatch) return null;

        return (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-textSecondary">
                {hasRating && (
                    <span className="inline-flex items-center gap-1">
                        <Star size={12} className="text-yellow-400" fill="currentColor" />
                        <span>{ratingDoc.rating}</span>
                    </span>
                )}
                {hasLiked && (
                    <span className="inline-flex items-center">
                        <Heart size={12} className="text-red-400" fill="currentColor" />
                    </span>
                )}
                {hasReview && (
                    <span className="inline-flex items-center">
                        <FileText size={12} className="text-textSecondary" />
                    </span>
                )}
                {hasRewatch && (
                    <span className="inline-flex items-center gap-1">
                        <Repeat size={12} className="text-textSecondary" />
                        <span>{viewCount}</span>
                    </span>
                )}
            </div>
        );
    };

    if (loading) {
        return <div className="text-center py-12 text-textSecondary">Loading watchlist...</div>;
    }

    if (watchlistItems.length === 0) {
        return <div className="text-center py-12 text-textSecondary">No items in watchlist</div>;
    }

    const filtered = filter === "all" ? watchlistItems : watchlistItems.filter(i => filter === "movie" ? i.mediaType === "movie" : i.mediaType === "tv");

    const movieCount = watchlistItems.filter(i => i.mediaType === "movie").length;
    const tvCount = watchlistItems.filter(i => i.mediaType === "tv").length;

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-5">
                {["all", "movie", "tv"].map(f => {
                    const count = f === "all" ? watchlistItems.length : f === "movie" ? movieCount : tvCount;
                    const label = f === "all" ? "All" : f === "movie" ? "Movies" : "Series";
                    return (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${filter === f ? "bg-accent text-white border-accent" : "bg-white/5 text-textSecondary border-white/10 hover:text-white"}`}>
                            {label} ({count})
                        </button>
                    );
                })}
            </div>
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-textSecondary">No {filter === "movie" ? "movies" : "series"} in watchlist</div>
            ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {filtered.map((item) => (
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
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute top-2 right-2 bg-accent/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                            WATCHLIST
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                            {item.title || item.name}
                        </h3>
                        {renderIndicators(ratingsByKey[`${item.mediaType}_${item.mediaId}`])}
                        <p className="text-xs text-textSecondary">
                            {item.addedAt?.seconds
                                ? new Date(item.addedAt.seconds * 1000).toLocaleDateString()
                                : "In Watchlist"}
                        </p>
                    </div>
                </Link>
            ))}
            </div>
            )}
        </div>
    );
}
