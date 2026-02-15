"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import ReviewCard from "@/components/ReviewCard";

function generateSlugFromTitle(text) {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/['']/g, "")
        .replace(/[&]/g, "and")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 80);
}

export default function ReviewsSection({ userId, username }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortMode, setSortMode] = useState("recent");
    const [likeCounts, setLikeCounts] = useState({});
    const [commentCounts, setCommentCounts] = useState({});

    const fetchReviews = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("userId", "==", userId)
            );
            const snap = await getDocs(q);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((r) => r.review && r.review.trim().length > 0)
                .sort((a, b) => (b.ratedAt?.seconds || 0) - (a.ratedAt?.seconds || 0));
            setReviews(items);
        } catch (error) {
            console.error("Error loading reviews:", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    useEffect(() => {
        const ids = reviews.map((r) => r.id).filter(Boolean);
        if (ids.length === 0) {
            setLikeCounts({});
            setCommentCounts({});
            return;
        }

        const chunks = [];
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

        const unsubs = [];
        const likesAgg = {};
        const commentsAgg = {};

        const recompute = () => {
            setLikeCounts({ ...likesAgg });
            setCommentCounts({ ...commentsAgg });
        };

        for (const chunk of chunks) {
            try {
                const likesQ = query(collection(db, "review_likes"), where("reviewDocId", "in", chunk));
                const unsubLikes = onSnapshot(likesQ, (snap) => {
                    // reset only keys in this chunk
                    for (const rid of chunk) likesAgg[rid] = 0;
                    snap.docs.forEach((d) => {
                        const data = d.data() || {};
                        const rid = data.reviewDocId;
                        if (!rid) return;
                        likesAgg[rid] = Number(likesAgg[rid] || 0) + 1;
                    });
                    recompute();
                }, () => {
                    for (const rid of chunk) likesAgg[rid] = 0;
                    recompute();
                });
                unsubs.push(unsubLikes);
            } catch (_) {}

            try {
                const commentsQ = query(collection(db, "review_comments"), where("reviewDocId", "in", chunk));
                const unsubComments = onSnapshot(commentsQ, (snap) => {
                    for (const rid of chunk) commentsAgg[rid] = 0;
                    snap.docs.forEach((d) => {
                        const data = d.data() || {};
                        const rid = data.reviewDocId;
                        if (!rid) return;
                        commentsAgg[rid] = Number(commentsAgg[rid] || 0) + 1;
                    });
                    recompute();
                }, () => {
                    for (const rid of chunk) commentsAgg[rid] = 0;
                    recompute();
                });
                unsubs.push(unsubComments);
            } catch (_) {}
        }

        return () => {
            unsubs.forEach((u) => {
                try { u(); } catch (_) {}
            });
        };
    }, [reviews]);

    const sortedReviews = useMemo(() => {
        const copy = [...reviews];
        if (sortMode === "popular") {
            copy.sort((a, b) => {
                const aScore = Number(likeCounts[a.id] || 0) + Number(commentCounts[a.id] || 0);
                const bScore = Number(likeCounts[b.id] || 0) + Number(commentCounts[b.id] || 0);
                if (bScore !== aScore) return bScore - aScore;
                return (b.ratedAt?.seconds || 0) - (a.ratedAt?.seconds || 0);
            });
            return copy;
        }
        copy.sort((a, b) => (b.ratedAt?.seconds || 0) - (a.ratedAt?.seconds || 0));
        return copy;
    }, [reviews, sortMode, likeCounts, commentCounts]);

    const getReviewLink = (item) => {
        if (username) {
            const slug = generateSlugFromTitle(item.title);
            return `/${username}/${slug}-${item.id}`;
        }
        // Fallback to media page
        if (item.mediaType === "tv") return `/tv/${item.mediaId}`;
        return `/movie/${item.mediaId}`;
    };

    const formatDate = (timestamp) => {
        if (!timestamp?.seconds) return "";
        return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
        });
    };

    if (loading) {
        return (
            <section>
                <h2 className="text-3xl font-bold mb-6">Reviews</h2>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-secondary rounded-xl p-5 border border-white/5 animate-pulse">
                            <div className="flex gap-4">
                                <div className="w-16 h-24 rounded-lg bg-white/10 shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-5 bg-white/10 rounded w-1/3" />
                                    <div className="h-3 bg-white/10 rounded w-1/4" />
                                    <div className="h-3 bg-white/10 rounded w-full" />
                                    <div className="h-3 bg-white/10 rounded w-2/3" />
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
                <div className="text-center py-12">
                    <MessageSquare size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                    <p className="text-textSecondary mb-2">No reviews yet</p>
                    <p className="text-sm text-textSecondary opacity-70">
                        Rate movies and TV shows with a written review to see them here
                    </p>
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
                                onClick={() => setSortMode(f.id)}
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                    sortMode === f.id
                                        ? "bg-accent text-white"
                                        : "bg-white/5 text-textSecondary hover:text-white"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <span className="text-sm text-textSecondary">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
                </div>
            </div>

            <div className="space-y-4">
                {sortedReviews.map((item) => (
                    <ReviewCard key={item.id} review={item} href={getReviewLink(item)} showPoster={false} showUser={false} />
                ))}
            </div>
        </section>
    );
}
