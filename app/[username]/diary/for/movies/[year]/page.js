"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import supabase from "@/lib/supabase";
import { getMediaUrl } from "@/lib/slugify";
import { tmdb } from "@/lib/tmdb";
import StarRating from "@/components/StarRating";
import { Calendar, Heart, Film } from "lucide-react";

const PAGE_SIZE = 24;

async function resolveUsernameToUid(username) {
    if (!username) return null;
    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.uid || null;
    } catch {
        return null;
    }
}

function formatDate(item) {
    if (item.watchedDate) {
        return new Date(item.watchedDate + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }
    if (item.ratedAt) {
        return new Date(item.ratedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }
    return "";
}

export default function MoviesDiaryYearPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";
    const year = params?.year ? parseInt(params.year, 10) : new Date().getFullYear();

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            setLoadingUser(true);
            const id = await resolveUsernameToUid(username);
            if (!mounted) return;
            setUid(id);
            setLoadingUser(false);
        };
        run();
        return () => { mounted = false; };
    }, [username]);

    useEffect(() => {
        if (!uid) return;
        let cancelled = false;

        const fetchDiary = async () => {
            setLoading(true);
            try {
                // Fetch all ratings for this user with mediaType=movie
                const { data, error } = await supabase
                    .from("user_ratings")
                    .select("*")
                    .eq("userId", uid)
                    .eq("mediaType", "movie");
                if (error) throw error;
                const items = (data || [])
                    .filter((item) => {
                        // Filter by year
                        if (item.watchedDate) {
                            return new Date(item.watchedDate + "T00:00:00").getFullYear() === year;
                        }
                        if (item.ratedAt) {
                            return new Date(item.ratedAt).getFullYear() === year;
                        }
                        return false;
                    })
                    .sort((a, b) => {
                        const aTime = a.ratedAt ? new Date(a.ratedAt).getTime() : 0;
                        const bTime = b.ratedAt ? new Date(b.ratedAt).getTime() : 0;
                        return bTime - aTime;
                    });

                if (!cancelled) {
                    setAllItems(items);
                    setVisibleCount(PAGE_SIZE);
                }
            } catch (err) {
                console.error("Error fetching movie diary:", err);
                if (!cancelled) setAllItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDiary();
        return () => { cancelled = true; };
    }, [uid, year]);

    const displayItems = allItems.slice(0, visibleCount);
    const hasMore = visibleCount < allItems.length;

    const loadMore = () => setVisibleCount((c) => c + PAGE_SIZE);

    const backHref = useMemo(() => {
        return username ? `/${encodeURIComponent(username)}?tab=diary` : "/";
    }, [username]);

    if (loadingUser) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!uid) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">User not found</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="site-container py-10">
                <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Film size={20} className="text-accent" />
                            <h1 className="text-3xl md:text-4xl font-bold truncate">Movies Diary - {year}</h1>
                        </div>
                        <div className="text-sm text-textSecondary truncate">@{username} · {allItems.length} entries</div>
                    </div>
                    <Link
                        href={backHref}
                        className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-textSecondary">Loading diary...</div>
                ) : displayItems.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No movie diary entries for {year}.</div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {displayItems.map((item) => (
                            <Link key={item.id} href={getMediaUrl({ id: item.mediaId, title: item.title, name: item.title }, "movie")} className="block">
                                <div className="flex items-center gap-4 p-3 md:p-4 bg-secondary rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                    <div className="shrink-0">
                                        {item.poster_path ? (
                                            <img
                                                src={tmdb.getImageUrl(item.poster_path, "w154", "poster")}
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
                                            {Number(item.rating || 0) > 0 && (
                                                <StarRating value={Number(item.rating || 0)} size={12} readonly showHalfStars />
                                            )}
                                            {item.liked && (
                                                <Heart size={12} className="text-red-400" fill="currentColor" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {hasMore && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={loadMore}
                            className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white"
                        >
                            Load more
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
