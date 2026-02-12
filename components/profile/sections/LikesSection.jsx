"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getMediaUrl } from "@/lib/slugify";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export default function LikesSection({ userId }) {
    const { user } = useAuth();
    const ownerId = userId || user?.uid;
    const [likes, setLikes] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Likes</h2>
                <span className="text-sm text-textSecondary">{likes.length} liked</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {likes.map((item) => {
                    const url = getMediaUrl(
                        { id: item.mediaId, title: item.title, name: item.title },
                        item.mediaType
                    );
                    return (
                        <Link key={item.id} href={url} className="group relative">
                            {item.poster_path ? (
                                <img
                                    src={`${TMDB_IMG}${item.poster_path}`}
                                    alt={item.title}
                                    className="w-full aspect-[2/3] rounded-xl object-cover group-hover:scale-105 transition-transform"
                                />
                            ) : (
                                <div className="w-full aspect-[2/3] rounded-xl bg-white/10 flex items-center justify-center">
                                    <Heart size={24} className="text-white/20" />
                                </div>
                            )}
                            <div className="absolute bottom-2 right-2">
                                <Heart size={16} className="text-red-400" fill="currentColor" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
