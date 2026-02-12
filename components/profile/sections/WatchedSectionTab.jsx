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

export default function WatchedSectionTab() {
    const { user } = useAuth();
    const params = useParams();
    const profileUserId = params?.id || user?.uid;

    const [watchedItems, setWatchedItems] = useState([]);
    const [filter, setFilter] = useState("all");
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

    useEffect(() => {
        fetchWatched();
    }, [fetchWatched]);

    // Listen for media updates and snapshot events
    useEffect(() => {
        const handler = () => fetchWatched();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("WATCHED_SNAPSHOT", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("WATCHED_SNAPSHOT", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchWatched]);

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

    const filteredItems = watchedItems.filter((item) => {
        if (filter === "all") return true;
        if (filter === "movies") return item.mediaType === "movie";
        if (filter === "series") return item.mediaType === "tv";
        return true;
    });

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
            <div className="flex gap-3 flex-wrap">
                {["all", "movies", "series"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${
                            filter === f
                                ? "bg-accent text-background"
                                : "bg-secondary text-textSecondary hover:bg-white/10"
                        }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                    </button>
                ))}
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-textSecondary">
                    No watched items yet
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {filteredItems.map((item) => (
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
                            </div>
                            <div className="mt-2">
                                <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                                    {item.title || item.name}
                                </h3>
                                <p className="text-xs text-textSecondary">
                                    {item.addedAt?.seconds
                                        ? new Date(item.addedAt.seconds * 1000).toLocaleDateString()
                                        : "Watched"}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
