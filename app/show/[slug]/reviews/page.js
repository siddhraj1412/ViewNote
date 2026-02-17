"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import supabase from "@/lib/supabase";
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
    const [offset, setOffset] = useState(0);

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

    const loadFirstPage = useCallback(async () => {
        if (!tvId) return;
        setLoadingMore(true);
        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("mediaId", Number(tvId))
                .eq("mediaType", "tv")
                .order("ratedAt", { ascending: false })
                .range(0, PAGE_SIZE - 1);
            if (error) throw error;
            const all = data || [];
            const items = all.filter((r) => r.review && r.review.trim().length > 0);
            setReviews(items);
            setOffset(all.length);
            setHasMore(all.length === PAGE_SIZE);
        } catch {
            setReviews([]);
            setOffset(0);
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [tvId]);

    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    const loadMore = useCallback(async () => {
        if (!tvId || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("mediaId", Number(tvId))
                .eq("mediaType", "tv")
                .order("ratedAt", { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            const all = data || [];
            const items = all.filter((r) => r.review && r.review.trim().length > 0);
            setReviews((prev) => [...prev, ...items]);
            setOffset((prev) => prev + all.length);
            setHasMore(all.length === PAGE_SIZE);
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [tvId, offset, loadingMore, hasMore]);

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
