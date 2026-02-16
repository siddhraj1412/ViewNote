"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Heart, Star, MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getMediaUrl } from "@/lib/slugify";
import { useParams } from "next/navigation";
import { tmdb } from "@/lib/tmdb";
import eventBus from "@/lib/eventBus";

const PREVIEW_SIZE = 24;

export default function LikesSection({ userId }) {
    const { user } = useAuth();
    const params = useParams();
    const usernameParam = params?.username;
    const ownerId = userId || user?.uid;
    const [likes, setLikes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState("newest");

    const fetchLikes = useCallback(async () => {
        if (!ownerId) { setLoading(false); return; }
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("userId", "==", ownerId),
                where("liked", "==", true)
            );
            const snap = await getDocs(q);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.ratedAt?.seconds || 0) - (a.ratedAt?.seconds || 0));
            setLikes(items);
        } catch (error) {
            console.error("Error loading likes:", error);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        fetchLikes();
    }, [fetchLikes]);

    useEffect(() => {
        const handler = () => fetchLikes();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
    }, [fetchLikes]);

    if (loading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    if (likes.length === 0) {
        return (
            <div className="text-center py-12">
                <Heart size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                <p className="text-textSecondary mb-2">No likes yet</p>
                <p className="text-sm text-textSecondary opacity-70">
                    Like movies and TV shows when rating to see them here
                </p>
            </div>
        );
    }

    const sortedLikes = useMemo(() => {
        const copy = [...likes];
        switch (sortBy) {
            case "oldest":
                copy.sort((a, b) => (a.ratedAt?.seconds || 0) - (b.ratedAt?.seconds || 0));
                break;
            case "a-z":
                copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                break;
            case "z-a":
                copy.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
                break;
            case "rating-high":
                copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case "rating-low":
                copy.sort((a, b) => (a.rating || 0) - (b.rating || 0));
                break;
            case "newest":
            default:
                copy.sort((a, b) => (b.ratedAt?.seconds || 0) - (a.ratedAt?.seconds || 0));
                break;
        }
        return copy;
    }, [likes, sortBy]);

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-6">
                <h2 className="text-3xl font-bold">Likes</h2>
                <div className="flex items-center gap-3">
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
                    <span className="text-sm text-textSecondary">{likes.length} liked</span>
                </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {sortedLikes.slice(0, PREVIEW_SIZE).map((item) => {
                    const url = getMediaUrl(
                        { id: item.mediaId, title: item.title, name: item.title },
                        item.mediaType
                    );
                    return (
                        <Link key={item.id} href={url} className="group">
                            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-secondary shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-all">
                                {item.poster_path ? (
                                    <Image
                                        src={tmdb.getImageUrl(item.poster_path)}
                                        alt={item.title || "Poster"}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                                        <Heart size={24} className="text-white/20" />
                                    </div>
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col justify-end p-2.5 opacity-0 group-hover:opacity-100">
                                    <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.title}</h4>
                                    <p className="text-[10px] text-white/70 mt-0.5 capitalize">{item.mediaType}</p>
                                </div>
                            </div>
                            {/* Metadata under poster */}
                            <div className="mt-1.5 flex items-center gap-1.5 min-h-[18px]">
                                {item.rating > 0 && (
                                    <span className="flex items-center gap-0.5 text-accent text-[10px] font-bold">
                                        <Star size={10} className="fill-accent" />
                                        {item.rating % 1 === 0 ? item.rating : item.rating.toFixed(1)}
                                    </span>
                                )}
                                <Heart size={10} className="text-red-400 fill-red-400" />
                                {item.review && (
                                    <MessageSquare size={10} className="text-blue-400" />
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>

            {likes.length > PREVIEW_SIZE && usernameParam && (
                <div className="flex justify-center mt-6">
                    <Link
                        href={`/${encodeURIComponent(usernameParam)}/likes`}
                        className="px-6 py-2.5 text-sm font-medium text-accent hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                        See More ({likes.length})
                    </Link>
                </div>
            )}
        </div>
    );
}
