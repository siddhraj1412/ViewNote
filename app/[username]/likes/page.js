"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import supabase from "@/lib/supabase";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { Heart } from "lucide-react";

const PAGE_SIZE = 18;

const SORT_OPTIONS = [
    { id: "newest", label: "Newest" },
    { id: "oldest", label: "Oldest" },
    { id: "a-z", label: "A → Z" },
    { id: "z-a", label: "Z → A" },
];

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

export default function LikesAllPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [filter, setFilter] = useState("all"); // "all" | "movie" | "tv"
    const [sortBy, setSortBy] = useState("newest");

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

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
        return () => {
            mounted = false;
        };
    }, [username]);

    const loadFirst = useCallback(async (userId, mediaFilter) => {
        if (!userId) return;
        setLoading(true);
        try {
            let q = supabase
                .from("user_ratings")
                .select("*")
                .eq("userId", userId)
                .eq("liked", true);
            if (mediaFilter && mediaFilter !== "all") {
                q = q.eq("mediaType", mediaFilter);
            }
            const { data, error } = await q
                .order("ratedAt", { ascending: false })
                .range(0, PAGE_SIZE - 1);
            if (error) throw error;
            const next = data || [];
            setItems(next);
            setOffset(next.length);
            setHasMore(next.length === PAGE_SIZE);
        } catch {
            setItems([]);
            setOffset(0);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!uid) return;
        loadFirst(uid, filter);
    }, [uid, filter, loadFirst]);

    const loadMore = useCallback(async () => {
        if (!uid || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            let q = supabase
                .from("user_ratings")
                .select("*")
                .eq("userId", uid)
                .eq("liked", true);
            if (filter && filter !== "all") {
                q = q.eq("mediaType", filter);
            }
            const { data, error } = await q
                .order("ratedAt", { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            const next = data || [];
            setItems((prev) => [...prev, ...next]);
            setOffset((prev) => prev + next.length);
            setHasMore(next.length === PAGE_SIZE);
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [uid, offset, loadingMore, hasMore, filter]);

    const backHref = useMemo(() => {
        return username ? `/${encodeURIComponent(username)}?tab=likes` : "/";
    }, [username]);

    const displayItems = useMemo(() => {
        const copy = [...items];
        switch (sortBy) {
            case "oldest":
                return copy.sort((a, b) => {
                    const aT = a.ratedAt ? new Date(a.ratedAt).getTime() : 0;
                    const bT = b.ratedAt ? new Date(b.ratedAt).getTime() : 0;
                    return aT - bT;
                });
            case "a-z":
                return copy.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
            case "z-a":
                return copy.sort((a, b) => (b.title || b.name || "").localeCompare(a.title || a.name || ""));
            case "newest":
            default:
                return copy;
        }
    }, [items, sortBy]);

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
                        <h1 className="text-3xl md:text-4xl font-bold truncate">Likes</h1>
                        <div className="text-sm text-textSecondary truncate">@{username}</div>
                    </div>
                    <Link
                        href={backHref}
                        className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back
                    </Link>
                </div>

                {/* Filter & Sort Controls */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <div className="flex gap-2">
                        {[
                            { id: "all", label: "All" },
                            { id: "movie", label: "Movies" },
                            { id: "tv", label: "Shows" },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                                    filter === f.id
                                        ? "bg-accent text-white"
                                        : "bg-white/5 text-textSecondary hover:text-white border border-white/10"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-background text-white border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <span className="text-xs text-textSecondary ml-auto">{displayItems.length} item{displayItems.length !== 1 ? "s" : ""}</span>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-textSecondary">Loading likes...</div>
                ) : displayItems.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No likes yet.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {displayItems.map((item) => {
                            const url = getMediaUrl({ id: item.mediaId, title: item.title, name: item.title }, item.mediaType);
                            return (
                                <Link key={item.id} href={url} className="group relative">
                                    {item.poster_path ? (
                                        <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900">
                                            <Image
                                                src={tmdb.getImageUrl(item.poster_path)}
                                                alt={item.title}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                                                loading="lazy"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-[2/3] rounded-xl bg-zinc-900 flex items-center justify-center">
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
                )}

                <div className="mt-8 flex justify-center">
                    {hasMore ? (
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white disabled:opacity-60"
                        >
                            {loadingMore ? "Loading..." : "Load more"}
                        </button>
                    ) : null}
                </div>
            </div>
        </main>
    );
}
