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

    return (
        <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {pausedItems.map((item) => (
                <Link
                    key={item.id}
                    href={getMediaUrl(item, item.mediaType)}
                    className="group"
                >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-all bg-zinc-900">
                        <Image
                            src={tmdb.getImageUrl(item.poster_path)}
                            alt={item.title || item.name || "Media"}
                            fill
                            className="object-contain object-center"
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
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
        </div>
    );
}
