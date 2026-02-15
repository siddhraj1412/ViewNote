"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import ReviewCard from "@/components/ReviewCard";

export default function ReviewsForMedia({ mediaId, mediaType, title }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewSort, setReviewSort] = useState("popular");
    const [likeCounts, setLikeCounts] = useState({});

    const fetchReviews = useCallback(async () => {
        if (!mediaId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("mediaId", "==", Number(mediaId))
            );
            const snap = await getDocs(q);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((r) => r.review && r.review.trim().length > 0 && (!mediaType || r.mediaType === mediaType));
            setReviews(items);
        } catch {
            setReviews([]);
        } finally {
            setLoading(false);
        }
    }, [mediaId, mediaType]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    useEffect(() => {
        if (!mediaId) {
            setLikeCounts({});
            return;
        }

        const ids = reviews.map((r) => r.id).filter(Boolean).slice(0, 30);
        if (ids.length === 0) {
            setLikeCounts({});
            return;
        }

        const likesQ = query(collection(db, "review_likes"), where("reviewDocId", "in", ids));

        // Firestore "in" supports max 30 items. Good enough for initial render.
        const unsub = onSnapshot(likesQ, (snap) => {
            const next = {};
            snap.docs.forEach((d) => {
                const data = d.data() || {};
                const rid = data.reviewDocId;
                if (!rid) return;
                next[rid] = Number(next[rid] || 0) + 1;
            });
            setLikeCounts(next);
        }, () => setLikeCounts({}));

        return () => {
            try { unsub(); } catch (_) {}
        };
    }, [mediaId, reviews]);

    const sortedReviews = useMemo(() => {
        const copy = [...reviews];
        if (reviewSort === "popular") {
            copy.sort((a, b) => {
                const aLikes = Number(likeCounts[a.id] || 0);
                const bLikes = Number(likeCounts[b.id] || 0);
                if (bLikes !== aLikes) return bLikes - aLikes;
                const aTime = a.createdAt?.seconds || a.ratedAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || b.ratedAt?.seconds || 0;
                return bTime - aTime;
            });
        } else {
            copy.sort((a, b) => {
                const aTime = a.createdAt?.seconds || a.ratedAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || b.ratedAt?.seconds || 0;
                return bTime - aTime;
            });
        }
        return copy;
    }, [reviews, reviewSort, likeCounts]);

    if (loading) {
        return (
            <section>
                <h2 className="text-3xl font-bold mb-6">Reviews</h2>
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-secondary rounded-xl p-5 border border-white/5 animate-pulse">
                            <div className="flex gap-4">
                                <div className="w-16 h-24 rounded-lg bg-white/10 shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-4 bg-white/10 rounded w-1/3" />
                                    <div className="h-3 bg-white/10 rounded w-1/4" />
                                    <div className="h-3 bg-white/10 rounded w-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (reviews.length === 0) {
        return (
            <section>
                <h2 className="text-3xl font-bold mb-6">Reviews</h2>
                <div className="bg-secondary rounded-xl border border-white/5 p-6">
                    <div className="text-sm text-textSecondary">No reviews yet for {title || "this title"}.</div>
                </div>
            </section>
        );
    }

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Reviews</h2>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        {[
                            { id: "recent", label: "Most Recent" },
                            { id: "popular", label: "Popular" },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setReviewSort(f.id)}
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                    reviewSort === f.id
                                        ? "bg-accent text-white"
                                        : "bg-white/5 text-textSecondary hover:text-white"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="text-sm text-textSecondary">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
                </div>
            </div>

            <div className="space-y-4">
                {sortedReviews.map((r) => {
                    return (
                        <ReviewCard key={r.id} review={r} showPoster={false} showUser />
                    );
                })}
            </div>
        </section>
    );
}
