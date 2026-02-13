"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import StarRating from "@/components/StarRating";
import { Heart, MessageSquare } from "lucide-react";

const TMDB_IMG = "https://image.tmdb.org/t/p";

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

export default function ReviewsForMedia({ mediaId, mediaType, title }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = useCallback(async () => {
        if (!mediaId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("mediaId", "==", Number(mediaId)),
                limit(500)
            );
            const snap = await getDocs(q);
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((r) => r.review && r.review.trim().length > 0 && (!mediaType || r.mediaType === mediaType))
                .sort((a, b) => {
                    const aTime = a.createdAt?.seconds || a.ratedAt?.seconds || 0;
                    const bTime = b.createdAt?.seconds || b.ratedAt?.seconds || 0;
                    return bTime - aTime;
                });
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
                <div className="text-sm text-textSecondary">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
            </div>

            <div className="space-y-4">
                {reviews.map((r) => {
                    const slug = generateSlugFromTitle(r.title);
                    const username = r.username || r.userId;
                    const href = `/${encodeURIComponent(username)}/${slug}-${r.mediaId}`;

                    return (
                        <Link key={r.id} href={href} className="block">
                            <div className="bg-secondary rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all">
                                <div className="flex gap-4">
                                    <div className="shrink-0">
                                        {r.poster_path ? (
                                            <img
                                                src={`${TMDB_IMG}/w154${r.poster_path}`}
                                                alt={r.title}
                                                className="w-16 h-24 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-16 h-24 rounded-lg bg-white/10 flex items-center justify-center">
                                                <MessageSquare size={16} className="text-white/20" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="font-bold text-white text-lg leading-tight truncate">{r.title}</div>
                                                <div className="text-xs text-textSecondary mt-0.5">@{r.username || "user"}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 mt-2">
                                            {r.rating > 0 && (
                                                <StarRating value={r.rating} size={14} readonly showHalfStars />
                                            )}
                                            {r.liked && (
                                                <Heart size={14} className="text-red-400" fill="currentColor" />
                                            )}
                                        </div>

                                        <p className="text-sm text-textSecondary mt-3 whitespace-pre-wrap leading-relaxed line-clamp-3">
                                            {r.review}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
