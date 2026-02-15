"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { Heart } from "lucide-react";

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

export default function LikesAllPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [filter, setFilter] = useState("all"); // "all" | "movie" | "tv"

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

    const loadFirst = useCallback(async (userId, mediaFilter) => {
        if (!userId) return;
        setLoading(true);
        try {
            const constraints = [
                where("userId", "==", userId),
                where("liked", "==", true),
            ];
            if (mediaFilter && mediaFilter !== "all") {
                constraints.push(where("mediaType", "==", mediaFilter));
            }
            constraints.push(orderBy("ratedAt", "desc"), limit(PAGE_SIZE));
            const q1 = query(collection(db, "user_ratings"), ...constraints);
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
        loadFirst(uid, filter);
    }, [uid, filter, loadFirst]);

    const loadMore = useCallback(async () => {
        if (!uid || !cursorDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const constraints = [
                where("userId", "==", uid),
                where("liked", "==", true),
            ];
            if (filter && filter !== "all") {
                constraints.push(where("mediaType", "==", filter));
            }
            constraints.push(orderBy("ratedAt", "desc"), startAfter(cursorDoc), limit(PAGE_SIZE));
            const q2 = query(collection(db, "user_ratings"), ...constraints);
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
    }, [uid, cursorDoc, loadingMore, hasMore, filter]);

    const backHref = useMemo(() => {
        return username ? `/${encodeURIComponent(username)}?tab=likes` : "/";
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

                {/* Filter buttons */}
                <div className="flex gap-2 mb-6">
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

                {loading ? (
                    <div className="text-center py-12 text-textSecondary">Loading likes...</div>
                ) : items.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No likes yet.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {items.map((item) => {
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
