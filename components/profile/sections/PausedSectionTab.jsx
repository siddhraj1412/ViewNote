"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import eventBus from "@/lib/eventBus";
import { mediaService } from "@/services/mediaService";

export default function PausedSectionTab({ userId }) {
    const { user } = useAuth();
    const params = useParams();
    const ownerId = userId || params?.id || user?.uid;

    const [pausedItems, setPausedItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    const fetchPaused = useCallback(async () => {
        if (!ownerId) return;
        setLoading(true);
        try {
            const data = await profileService.getPaused(ownerId);
            setPausedItems(data || []);
        } catch (e) {
            console.error("Error fetching paused:", e);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        fetchPaused();
    }, [fetchPaused]);

    useEffect(() => {
        const handler = () => fetchPaused();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("PAUSED_SNAPSHOT", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("PAUSED_SNAPSHOT", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchPaused]);

    // Attach realtime listener
    useEffect(() => {
        if (!ownerId) return;
        const cleanup = mediaService.attachProfileListeners(ownerId, (key, items) => {
            if (key === "paused") {
                setPausedItems(items);
            }
        });
        return cleanup;
    }, [ownerId]);

    if (loading) {
        return <div className="text-center py-12 text-textSecondary">Loading paused items...</div>;
    }

    if (pausedItems.length === 0) {
        return <div className="text-center py-12 text-textSecondary">No paused items</div>;
    }

    const filtered = filter === "all" ? pausedItems : pausedItems.filter(i => filter === "movie" ? i.mediaType === "movie" : i.mediaType === "tv");

    const movieCount = pausedItems.filter(i => i.mediaType === "movie").length;
    const tvCount = pausedItems.filter(i => i.mediaType === "tv").length;

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-5">
                {["all", "movie", "tv"].map(f => {
                    const count = f === "all" ? pausedItems.length : f === "movie" ? movieCount : tvCount;
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
                <div className="text-center py-12 text-textSecondary">No {filter === "movie" ? "movies" : "series"} paused</div>
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
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white/90 border border-white/10">
                            PAUSED
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                            {item.title || item.name}
                        </h3>
                        <p className="text-xs text-textSecondary">
                            {item.pausedAt?.seconds
                                ? new Date(item.pausedAt.seconds * 1000).toLocaleDateString()
                                : "Paused"}
                        </p>
                    </div>
                </Link>
            ))}
            </div>
            )}
        </div>
    );
}
