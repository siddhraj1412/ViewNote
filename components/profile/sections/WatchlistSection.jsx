"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

const PREVIEW_SIZE = 24;

export default function WatchlistSection({ userId }) {
    const { user } = useAuth();
    const params = useParams();
    const ownerId = userId || params?.id || user?.uid;
    const usernameParam = params?.username;

    const [watchlistItems, setWatchlistItems] = useState([]);
    const [ratingsByKey, setRatingsByKey] = useState({});
    const [loading, setLoading] = useState(true);

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

    const previewItems = useMemo(() => {
        return (watchlistItems || []).slice(0, PREVIEW_SIZE);
    }, [watchlistItems]);

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

    return (
        <div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {previewItems.map((item) => (
                <Link
                    key={item.id}
                    href={getMediaUrl(item, item.mediaType)}
                    className="group"
                >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-all bg-zinc-900">
                        {item.poster_path ? (
                            <Image
                                src={tmdb.getImageUrl(item.poster_path)}
                                alt={item.title || item.name || "Media"}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                                loading="lazy"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                <span className="text-xs text-white/40 text-center px-2 line-clamp-3">{item.title || item.name || "No poster"}</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col justify-end p-2.5 opacity-0 group-hover:opacity-100">
                            <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.title || item.name}</h4>
                        </div>
                    </div>
                    {renderIndicators(ratingsByKey[`${item.mediaType}_${item.mediaId}`])}
                </Link>
            ))}
            </div>
            {watchlistItems.length > PREVIEW_SIZE && usernameParam && (
                <div className="flex justify-center mt-6">
                    <Link
                        href={`/${encodeURIComponent(usernameParam)}/watchlist`}
                        className="px-6 py-2.5 text-sm font-medium text-accent hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                        See More ({watchlistItems.length})
                    </Link>
                </div>
            )}
        </div>
    );
}
