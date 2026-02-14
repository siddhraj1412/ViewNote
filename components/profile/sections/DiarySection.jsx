"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Heart } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getMediaUrl } from "@/lib/slugify";
import StarRating from "@/components/StarRating";
import eventBus from "@/lib/eventBus";

const TMDB_IMG = "https://image.tmdb.org/t/p/w154";
const PAGE_SIZE = 50;

export default function DiarySection({ userId }) {
    const { user } = useAuth();
    const ownerId = userId || user?.uid;
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);

    const fetchDiary = useCallback(async () => {
        if (!ownerId) { setLoading(false); return; }
        setLoading(true);
        try {
            // Try with orderBy first (requires composite index)
            let snap;
            try {
                const q = query(
                    collection(db, "user_ratings"),
                    where("userId", "==", ownerId),
                    orderBy("ratedAt", "desc"),
                    limit(200)
                );
                snap = await getDocs(q);
            } catch (indexErr) {
                // Fallback: query without orderBy if index isn't deployed yet
                console.warn("Diary index not ready, falling back:", indexErr.message);
                const fallbackQ = query(
                    collection(db, "user_ratings"),
                    where("userId", "==", ownerId),
                    limit(200)
                );
                snap = await getDocs(fallbackQ);
            }
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const timeA = a.ratedAt?.seconds || 0;
                    const timeB = b.ratedAt?.seconds || 0;
                    return timeB - timeA;
                });
            setEntries(items);
        } catch (error) {
            console.error("Error loading diary:", error);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        fetchDiary();
    }, [fetchDiary]);

    // Refresh on new ratings
    useEffect(() => {
        const handler = () => fetchDiary();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("PROFILE_DATA_INVALIDATED", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("PROFILE_DATA_INVALIDATED", handler);
        };
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

    const getTVTargetBadge = (item) => {
        if (item?.mediaType !== "tv") return null;
        const t = item?.targetType || "series";
        const s = item?.seasonNumber;
        const e = item?.episodeNumber;
        if (t === "episode" && Number.isFinite(Number(s)) && Number.isFinite(Number(e))) {
            return `S${Number(s)}E${Number(e)}`;
        }
        if (t === "season" && Number.isFinite(Number(s))) {
            return `S${Number(s)}`;
        }
        return null;
    };

    const getDisplayTitle = (item) => {
        if (item?.mediaType !== "tv") return item?.title || "";
        const t = item?.targetType || "series";
        const s = item?.seasonNumber;
        const e = item?.episodeNumber;
        if (t === "episode" && Number.isFinite(Number(s)) && Number.isFinite(Number(e))) {
            return `${item.title} (S${Number(s)}E${Number(e)})`;
        }
        if (t === "season" && Number.isFinite(Number(s))) {
            return `${item.title} (S${Number(s)})`;
        }
        return item?.title || "";
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
                {(showAll ? entries : entries.slice(0, PAGE_SIZE)).map((item) => {
                    const url = getMediaUrl(
                        { id: item.mediaId, title: item.title, name: item.title },
                        item.mediaType
                    );
                    const badge = getTVTargetBadge(item);
                    const displayTitle = getDisplayTitle(item);
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
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h3 className="font-semibold text-white text-sm md:text-base truncate">{displayTitle}</h3>
                                        {badge && (
                                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                                                {badge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-xs text-textSecondary">{formatDate(item)}</span>
                                        {item.rating > 0 && (
                                            <StarRating value={item.rating} size={12} readonly showHalfStars />
                                        )}
                                        {item.liked && (
                                            <Heart size={12} className="text-red-400" fill="currentColor" />
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs text-textSecondary capitalize shrink-0">{item.mediaType}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {!showAll && entries.length > PAGE_SIZE && (
                <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full py-2.5 text-sm font-medium text-accent hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                    Show all {entries.length} entries
                </button>
            )}
        </div>
    );
}
