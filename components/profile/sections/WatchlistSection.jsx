"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
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
        });
        return cleanup;
    }, [ownerId]);

    if (loading) {
        return <div className="text-center py-12 text-textSecondary">Loading watchlist...</div>;
    }

    if (watchlistItems.length === 0) {
        return <div className="text-center py-12 text-textSecondary">No items in watchlist</div>;
    }

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {watchlistItems.map((item) => (
                <Link
                    key={item.id}
                    href={`/${item.mediaType}/${item.mediaId}`}
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
                        <p className="text-xs text-textSecondary">
                            {item.addedAt?.seconds
                                ? new Date(item.addedAt.seconds * 1000).toLocaleDateString()
                                : "In Watchlist"}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
