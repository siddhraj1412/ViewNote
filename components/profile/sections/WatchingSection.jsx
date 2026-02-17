"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import eventBus from "@/lib/eventBus";
import { mediaService } from "@/services/mediaService";

export default function WatchingSection() {
    const { user } = useAuth();
    const params = useParams();
    const ownerId = params?.id || user?.uid;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWatching = useCallback(async () => {
        if (!ownerId) return;
        setLoading(true);
        try {
            const data = await profileService.getWatching(ownerId);
            setItems(data || []);
        } catch (e) {
            console.error("Error fetching watching:", e);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        fetchWatching();
    }, [fetchWatching]);

    useEffect(() => {
        const handler = () => fetchWatching();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("WATCHING_SNAPSHOT", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("WATCHING_SNAPSHOT", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchWatching]);

    useEffect(() => {
        if (!ownerId) return;
        const cleanup = mediaService.attachProfileListeners(ownerId, (key, dataItems) => {
            if (key === "watching") {
                setItems(dataItems);
            }
        });
        return cleanup;
    }, [ownerId]);

    if (loading) {
        return <div className="text-center py-12 text-textSecondary">Loading currently watching...</div>;
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-textSecondary">Currently watching TV series will appear here</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {items.map((item) => (
                <Link
                    key={item.id}
                    href={getMediaUrl({
                        id: item.seriesId ?? item.mediaId,
                        name: item.title || item.name,
                        title: item.title || item.name,
                    }, "tv")}
                    className="group"
                >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-all bg-secondary">
                        <Image
                            src={tmdb.getImageUrl(item.poster_path)}
                            alt={item.title || item.name || "Series"}
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
                            {item.startedAt
                                ? new Date(item.startedAt).toLocaleDateString()
                                : "Watching"}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
