"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getMediaUrl } from "@/lib/slugify";
import { tmdb } from "@/lib/tmdb";
import StarRating from "@/components/StarRating";
import { Calendar, Heart } from "lucide-react";

const PAGE_SIZE = 30;

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
            year: "numeric",
        });
    }
    if (item.ratedAt?.seconds) {
        return new Date(item.ratedAt.seconds * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }
    return "";
}

export default function DiaryAllPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);

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
                collection(db, "user_ratings"),
                where("userId", "==", userId),
                orderBy("ratedAt", "desc"),
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
                collection(db, "user_ratings"),
                where("userId", "==", uid),
                orderBy("ratedAt", "desc"),
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
                        <h1 className="text-3xl md:text-4xl font-bold truncate">Diary</h1>
                        <div className="text-sm text-textSecondary truncate">@{username}</div>
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
                ) : items.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No diary entries.</div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <Link key={item.id} href={getMediaUrl({ id: item.mediaId, title: item.title, name: item.title }, item.mediaType)} className="block">
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
                                    <span className="text-xs text-textSecondary capitalize shrink-0">{item.mediaType}</span>
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
