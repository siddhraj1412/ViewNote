"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Heart, Eye } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getMediaUrl } from "@/lib/slugify";
import StarRating from "@/components/StarRating";

const TMDB_IMG = "https://image.tmdb.org/t/p/w154";

export default function DiarySection() {
    const { user } = useAuth();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDiary = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("userId", "==", user.uid)
            );
            const snap = await getDocs(q);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    // Sort by watchedDate if available, else ratedAt
                    const dateA = a.watchedDate || (a.ratedAt?.seconds ? new Date(a.ratedAt.seconds * 1000).toISOString().slice(0, 10) : "");
                    const dateB = b.watchedDate || (b.ratedAt?.seconds ? new Date(b.ratedAt.seconds * 1000).toISOString().slice(0, 10) : "");
                    return dateB.localeCompare(dateA);
                });
            setEntries(items);
        } catch (error) {
            console.error("Error loading diary:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDiary();
    }, [fetchDiary]);

    const formatDate = (item) => {
        if (item.watchedDate) {
            return new Date(item.watchedDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
            });
        }
        if (item.ratedAt?.seconds) {
            return new Date(item.ratedAt.seconds * 1000).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
            });
        }
        return "";
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-secondary rounded-xl border border-white/5 animate-pulse">
                        <div className="w-12 h-18 rounded-lg bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-1/3" />
                            <div className="h-3 bg-white/10 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="text-center py-12">
                <Calendar size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                <p className="text-textSecondary mb-2">No diary entries yet</p>
                <p className="text-sm text-textSecondary opacity-70">
                    Rate movies and TV shows to build your diary
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Diary</h2>
                <span className="text-sm text-textSecondary">{entries.length} entries</span>
            </div>
            <div className="space-y-2">
                {entries.map((item) => {
                    const url = getMediaUrl(
                        { id: item.mediaId, title: item.title, name: item.title },
                        item.mediaType
                    );
                    return (
                        <Link key={item.id} href={url} className="block">
                            <div className="flex items-center gap-4 p-3 md:p-4 bg-secondary rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                <div className="shrink-0">
                                    {item.poster_path ? (
                                        <img
                                            src={`${TMDB_IMG}${item.poster_path}`}
                                            alt={item.title}
                                            className="w-10 h-[60px] rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-[60px] rounded-lg bg-white/10" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white text-sm md:text-base truncate">{item.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-xs text-textSecondary">{formatDate(item)}</span>
                                        {item.rating > 0 && (
                                            <StarRating value={item.rating} size={12} readonly showHalfStars />
                                        )}
                                        {item.liked && (
                                            <Heart size={12} className="text-red-400" fill="currentColor" />
                                        )}
                                        {item.viewCount > 1 && (
                                            <span className="text-[10px] text-textSecondary flex items-center gap-0.5">
                                                <Eye size={10} />{item.viewCount}x
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs text-textSecondary capitalize shrink-0">{item.mediaType}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
