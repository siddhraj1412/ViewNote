"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { tmdb } from "@/lib/tmdb";
import { parseSlugId, getShowUrl } from "@/lib/slugify";
import ReviewCard from "@/components/ReviewCard";

const PAGE_SIZE = 12;

export default function ShowReviewsPage() {
    const params = useParams();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const [tv, setTv] = useState(null);
    const [loading, setLoading] = useState(true);

    const [reviews, setReviews] = useState([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [cursorDoc, setCursorDoc] = useState(null);

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            if (!tvId) {
                if (mounted) {
                    setTv(null);
                    setLoading(false);
                }
                return;
            }
            try {
                const tvData = await tmdb.getTVDetails(tvId);
                if (mounted) setTv(tvData || null);
            } catch {
                if (mounted) setTv(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        run();
        return () => {
            mounted = false;
        };
    }, [tvId]);

    const baseQuery = useMemo(() => {
        if (!tvId) return null;
        return query(
            collection(db, "user_ratings"),
            where("mediaId", "==", Number(tvId)),
            where("mediaType", "==", "tv"),
            orderBy("ratedAt", "desc"),
            limit(PAGE_SIZE)
        );
    }, [tvId]);

    const loadFirstPage = useCallback(async () => {
        if (!baseQuery) return;
        setLoadingMore(true);
        try {
            const snap = await getDocs(baseQuery);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((r) => r.review && r.review.trim().length > 0);
            setReviews(items);
            setCursorDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch {
            setReviews([]);
            setCursorDoc(null);
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [baseQuery]);

    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    const loadMore = useCallback(async () => {
        if (!tvId || !cursorDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const q2 = query(
                collection(db, "user_ratings"),
                where("mediaId", "==", Number(tvId)),
                where("mediaType", "==", "tv"),
                orderBy("ratedAt", "desc"),
                startAfter(cursorDoc),
                limit(PAGE_SIZE)
            );
            const snap = await getDocs(q2);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((r) => r.review && r.review.trim().length > 0);
            setReviews((prev) => [...prev, ...items]);
            setCursorDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : cursorDoc);
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [tvId, cursorDoc, loadingMore, hasMore]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!tvId || !tv) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">TV show not found</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="site-container py-10">
                <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="min-w-0">
                        <h1 className="text-3xl md:text-4xl font-bold truncate">Reviews</h1>
                        <div className="text-sm text-textSecondary truncate">{tv.name}</div>
                    </div>
                    <Link
                        href={getShowUrl(tv)}
                        className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back to show
                    </Link>
                </div>

                {reviews.length === 0 && !loadingMore ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">No reviews yet.</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((r) => (
                            <ReviewCard key={r.id} review={r} showPoster={false} showUser showText />
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
