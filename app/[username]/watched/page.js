"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import supabase from "@/lib/supabase";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { Star, Heart, MessageSquare, RotateCcw } from "lucide-react";

const PAGE_SIZE = 18;

const SORT_OPTIONS = [
    { id: "newest", label: "Newest" },
    { id: "oldest", label: "Oldest" },
    { id: "a-z", label: "A → Z" },
    { id: "z-a", label: "Z → A" },
];

const FILTER_OPTIONS = [
    { id: "all", label: "All" },
    { id: "movie", label: "Movies" },
    { id: "tv", label: "Shows" },
];

const STAR_FILTER_OPTIONS = [
    { id: "all", label: "All Ratings" },
    ...([5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((s) => ({
        id: String(s),
        label: `${"★".repeat(Math.floor(s))}${s % 1 ? "½" : ""} (${s})`,
    }))),
    { id: "0", label: "Unrated" },
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

function sortItems(items, sortBy) {
    const copy = [...items];
    switch (sortBy) {
        case "oldest":
            return copy.sort((a, b) => {
                const aT = new Date(a.addedAt || 0).getTime();
                const bT = new Date(b.addedAt || 0).getTime();
                return aT - bT;
            });
        case "a-z":
            return copy.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
        case "z-a":
            return copy.sort((a, b) => (b.title || b.name || "").localeCompare(a.title || a.name || ""));
        case "newest":
        default:
            return copy.sort((a, b) => {
                const aT = new Date(a.addedAt || 0).getTime();
                const bT = new Date(b.addedAt || 0).getTime();
                return bT - aT;
            });
    }
}

export default function WatchedAllPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [sortBy, setSortBy] = useState("newest");
    const [filterType, setFilterType] = useState("all");
    const [starFilter, setStarFilter] = useState("all");
    const [ratingsMap, setRatingsMap] = useState({});

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

    const loadFirst = useCallback(async (userId) => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from("user_watched")
                .select("*")
                .eq("userId", userId)
                .order("addedAt", { ascending: false })
                .range(0, PAGE_SIZE - 1);
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
        loadFirst(uid);
        // Also fetch ratings for metadata display
        const fetchRatings = async () => {
            try {
                const { data } = await supabase
                    .from("user_ratings")
                    .select("*")
                    .eq("userId", uid);
                const map = {};
                (data || []).forEach((d) => {
                    const key = `${d.mediaType}_${d.mediaId}`;
                    if (!map[key] || (d.targetType || d.tvTargetType || "series") === "series") {
                        map[key] = {
                            rating: d.rating || 0,
                            liked: d.liked || false,
                            review: d.review || "",
                            viewCount: d.viewCount || (d.isRewatch ? 2 : 1),
                        };
                    }
                });
                setRatingsMap(map);
            } catch (_) {}
        };
        fetchRatings();
    }, [uid, loadFirst]);

    const loadMore = useCallback(async () => {
        if (!uid || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const { data } = await supabase
                .from("user_watched")
                .select("*")
                .eq("userId", uid)
                .order("addedAt", { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);
            const next = data || [];
            setItems((prev) => [...prev, ...next]);
            setOffset((prev) => prev + next.length);
            setHasMore(next.length === PAGE_SIZE);
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [uid, offset, loadingMore, hasMore]);

    const backHref = useMemo(() => {
        return username ? `/${encodeURIComponent(username)}?tab=watched` : "/";
    }, [username]);

    const displayItems = useMemo(() => {
        let filtered = items;
        if (filterType !== "all") {
            filtered = filtered.filter((item) => item.mediaType === filterType);
        }
        if (starFilter !== "all") {
            const targetStar = Number(starFilter);
            filtered = filtered.filter((item) => {
                const key = `${item.mediaType}_${item.mediaId}`;
                const meta = ratingsMap[key];
                if (!meta) return targetStar === 0;
                return Math.round(meta.rating * 2) / 2 === targetStar;
            });
        }
        return sortItems(filtered, sortBy);
    }, [items, sortBy, filterType, starFilter, ratingsMap]);

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
                        <h1 className="text-3xl md:text-4xl font-bold truncate">Watched</h1>
                        <div className="text-sm text-textSecondary truncate">@{username}</div>
                    </div>
                    <Link
                        href={backHref}
                        className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back
                    </Link>
                </div>

                {/* Sort & Filter Controls */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-background text-white border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-background text-white border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                    >
                        {FILTER_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        value={starFilter}
                        onChange={(e) => setStarFilter(e.target.value)}
                        className="bg-background text-white border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                    >
                        {STAR_FILTER_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <span className="text-xs text-textSecondary ml-auto">{displayItems.length} item{displayItems.length !== 1 ? "s" : ""}</span>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-textSecondary">Loading watched...</div>
                ) : displayItems.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No watched items.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {displayItems.map((item) => {
                            const key = `${item.mediaType}_${item.mediaId}`;
                            const meta = ratingsMap[key];
                            return (
                                <Link key={item.id} href={getMediaUrl(item, item.mediaType)} className="group">
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-all bg-secondary">
                                        <Image
                                            src={tmdb.getImageUrl(item.poster_path)}
                                            alt={item.title || item.name || "Media"}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                                            loading="lazy"
                                        />
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col justify-end p-2.5 opacity-0 group-hover:opacity-100">
                                            <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.title || item.name}</h4>
                                            <p className="text-[10px] text-white/70 mt-0.5">
                                                {item.release_date?.split?.("-")?.[0] || item.first_air_date?.split?.("-")?.[0] || ""}
                                            </p>
                                            {meta?.rating > 0 && (
                                                <div className="flex items-center gap-0.5 mt-1">
                                                    <Star size={10} className="text-accent fill-accent" />
                                                    <span className="text-[10px] text-accent font-bold">{meta.rating}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Metadata under poster */}
                                    <div className="mt-1.5 flex items-center gap-1.5 min-h-[18px]">
                                        {meta?.rating > 0 && (
                                            <span className="flex items-center gap-0.5 text-accent text-[10px] font-bold">
                                                <Star size={10} className="fill-accent" />
                                                {meta.rating % 1 === 0 ? meta.rating : meta.rating.toFixed(1)}
                                            </span>
                                        )}
                                        {meta?.liked && <Heart size={10} className="text-red-400 fill-red-400" />}
                                        {meta?.review && <MessageSquare size={10} className="text-blue-400" />}
                                        {meta?.viewCount > 1 && (
                                            <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                                                <RotateCcw size={9} />
                                                {meta.viewCount}
                                            </span>
                                        )}
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
