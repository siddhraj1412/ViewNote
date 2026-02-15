"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { profileService } from "@/services/profileService";
import { tmdb } from "@/lib/tmdb";
import Image from "next/image";
import Link from "next/link";
import { Film, Tv, Play } from "lucide-react";
import eventBus from "@/lib/eventBus";

export default function ProfileFavoritesGrid({ userId }) {
    const { user } = useAuth();
    const [movies, setMovies] = useState([]);
    const [shows, setShows] = useState([]);
    const [episodes, setEpisodes] = useState([]);
    const [loading, setLoading] = useState(true);

    const ownerId = userId || user?.uid;

    const loadFavorites = useCallback(async () => {
        if (!ownerId) return;
        setLoading(true);
        try {
            const { movies, shows, episodes } = await profileService.getFavorites(ownerId);
            setMovies(movies);
            setShows(shows);
            setEpisodes(episodes || []);
        } catch (error) {
            console.error("Error loading favorites:", error);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        loadFavorites();
    }, [loadFavorites]);

    useEffect(() => {
        const handler = () => loadFavorites();
        eventBus.on("FAVORITES_UPDATED", handler);
        eventBus.on("MEDIA_UPDATED", handler); // Also refresh on media updates (customizations)
        return () => {
            eventBus.off("FAVORITES_UPDATED", handler);
            eventBus.off("MEDIA_UPDATED", handler);
        };
    }, [loadFavorites]);

    if (loading) {
        return (
            <div className="space-y-8">
                {[0, 1, 2].map((row) => (
                    <div key={row}>
                        <div className="h-5 w-32 bg-white/10 rounded mb-4 animate-pulse" />
                        <div className="grid grid-cols-5 gap-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <FavoritesRow
                title="Favorite Movies"
                icon={<Film size={20} className="text-accent" />}
                items={movies}
                mediaType="movie"
                emptyLabel="Movie"
            />
            <FavoritesRow
                title="Favorite Series"
                icon={<Tv size={20} className="text-accent" />}
                items={shows}
                mediaType="tv"
                emptyLabel="Series"
            />
            <EpisodesRow
                title="Favorite Episodes"
                icon={<Play size={20} className="text-accent" />}
                items={episodes}
            />
        </div>
    );
}

function FavoritesRow({ title, icon, items, mediaType, emptyLabel }) {
    const filledSlots = items.slice(0, 5);
    const emptyCount = Math.max(0, 5 - filledSlots.length);

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h3 className="text-lg font-bold">{title}</h3>
            </div>
            <div className="grid grid-cols-5 gap-3">
                {filledSlots.map((item) => (
                    <Link
                        key={item.id}
                        href={`/${mediaType}/${item.mediaId}`}
                        className="group"
                    >
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary group-hover:ring-2 group-hover:ring-accent transition-all">
                            {item.poster_path ? (
                                <Image
                                    src={tmdb.getImageUrl(item.poster_path, "w342")}
                                    alt={item.title || "Poster"}
                                    fill
                                    className="object-cover"
                                    loading="lazy"
                                    sizes="20vw"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                    <Film size={24} className="text-white/20" />
                                </div>
                            )}

                        </div>
                        <p className="mt-1.5 text-xs font-medium line-clamp-1 group-hover:text-accent transition-colors">
                            {item.title}
                        </p>
                    </Link>
                ))}

                {[...Array(emptyCount)].map((_, i) => (
                    <div key={`empty-${i}`}>
                        <div className="relative aspect-[2/3] rounded-xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                            <Film size={20} className="text-white/15" />
                        </div>
                        <p className="mt-1.5 text-xs text-white/20 text-center">—</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EpisodesRow({ title, icon, items }) {
    const filledSlots = items.slice(0, 5);
    const emptyCount = Math.max(0, 5 - filledSlots.length);

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h3 className="text-lg font-bold">{title}</h3>
            </div>
            <div className="grid grid-cols-5 gap-3">
                {filledSlots.map((item) => {
                    const href = item.seriesId ? `/show/${item.seriesId}` : "#";
                    return (
                        <Link key={item.id} href={href} className="group">
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary ring-1 ring-white/5 group-hover:ring-2 group-hover:ring-accent transition-all">
                                {(item.still_path || item.poster_path) ? (
                                    <Image
                                        src={tmdb.getImageUrl(item.still_path || item.poster_path, "w300")}
                                        alt={item.episodeName || item.title || "Episode"}
                                        fill
                                        className="object-cover"
                                        loading="lazy"
                                        sizes="20vw"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                                        <Play size={20} className="text-white/20" />
                                    </div>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                    <p className="text-[10px] text-white/90 font-medium line-clamp-1">
                                        {item.episodeName || item.title}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-1 text-[11px] text-textSecondary line-clamp-1 group-hover:text-accent transition-colors">
                                {item.series_name || ""}
                                {item.seasonNumber != null && item.episodeNumber != null ? ` · S${item.seasonNumber}E${item.episodeNumber}` : ""}
                            </p>
                        </Link>
                    );
                })}

                {[...Array(emptyCount)].map((_, i) => (
                    <div key={`empty-ep-${i}`}>
                        <div className="relative aspect-video rounded-xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                            <Play size={16} className="text-white/15" />
                        </div>
                        <p className="mt-1 text-[11px] text-white/20 text-center">—</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
