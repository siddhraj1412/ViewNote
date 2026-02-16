"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";

const PAGE_SIZE = 18;

const SORT_OPTIONS = [
    { id: "newest", label: "Added: Newest" },
    { id: "oldest", label: "Added: Oldest" },
    { id: "popularity", label: "Popularity" },
    { id: "release-desc", label: "Release: Newest" },
    { id: "release-asc", label: "Release: Oldest" },
    { id: "rating-desc", label: "Rating: High → Low" },
    { id: "rating-asc", label: "Rating: Low → High" },
    { id: "a-z", label: "A → Z" },
    { id: "z-a", label: "Z → A" },
];

const FILTER_OPTIONS = [
    { id: "all", label: "All" },
    { id: "movie", label: "Movies" },
    { id: "tv", label: "Shows" },
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
            return copy.sort((a, b) => (a.addedAt?.seconds || 0) - (b.addedAt?.seconds || 0));
        case "popularity":
            return copy.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        case "release-desc":
            return copy.sort((a, b) => {
                const aD = a.release_date || a.first_air_date || "";
                const bD = b.release_date || b.first_air_date || "";
                return bD.localeCompare(aD);
            });
        case "release-asc":
            return copy.sort((a, b) => {
                const aD = a.release_date || a.first_air_date || "";
                const bD = b.release_date || b.first_air_date || "";
                return aD.localeCompare(bD);
            });
        case "rating-desc":
            return copy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        case "rating-asc":
            return copy.sort((a, b) => (a.vote_average || 0) - (b.vote_average || 0));
        case "a-z":
            return copy.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
        case "z-a":
            return copy.sort((a, b) => (b.title || b.name || "").localeCompare(a.title || a.name || ""));
        case "newest":
        default:
            return copy.sort((a, b) => (b.addedAt?.seconds || 0) - (a.addedAt?.seconds || 0));
    }
}

export default function WatchlistAllPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [sortBy, setSortBy] = useState("newest");
    const [filterType, setFilterType] = useState("all");

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [cursorDoc, setCursorDoc] = useState(null);

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
            const q1 = query(
                collection(db, "user_watchlist"),
                where("userId", "==", userId),
                orderBy("addedAt", "desc"),
                limit(PAGE_SIZE)
            );
            const snap = await getDocs(q1);
            const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setItems(next);
            setCursorDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch {
            setItems([]);
            setCursorDoc(null);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!uid) return;
        loadFirst(uid);
    }, [uid, loadFirst]);

    const loadMore = useCallback(async () => {
        if (!uid || !cursorDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const q2 = query(
                collection(db, "user_watchlist"),
                where("userId", "==", uid),
                orderBy("addedAt", "desc"),
                startAfter(cursorDoc),
                limit(PAGE_SIZE)
            );
            const snap = await getDocs(q2);
            const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setItems((prev) => [...prev, ...next]);
            setCursorDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : cursorDoc);
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [uid, cursorDoc, loadingMore, hasMore]);

    const backHref = useMemo(() => {
        return username ? `/${encodeURIComponent(username)}?tab=watchlist` : "/";
    }, [username]);

    const displayItems = useMemo(() => {
        let filtered = items;
        if (filterType !== "all") {
            filtered = items.filter((item) => item.mediaType === filterType);
        }
        return sortItems(filtered, sortBy);
    }, [items, sortBy, filterType]);

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
                        <h1 className="text-3xl md:text-4xl font-bold truncate">Watchlist</h1>
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
                    <span className="text-xs text-textSecondary ml-auto">{displayItems.length} item{displayItems.length !== 1 ? "s" : ""}</span>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-textSecondary">Loading watchlist...</div>
                ) : displayItems.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No watchlist items.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {displayItems.map((item) => (
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
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </div>
                            </Link>
                        ))}
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
