"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Heart, Calendar, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import StarRating from "@/components/StarRating";
import { reviewService } from "@/services/reviewService";

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

export default function ReviewsSection({ userId, username }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [socialCounts, setSocialCounts] = useState({}); // { [reviewId]: { likes: N, comments: N } }

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

            // Fetch like and comment counts for each review
            const counts = {};
            await Promise.all(items.map(async (item) => {
                try {
                    const [likeCount, comments] = await Promise.all([
                        reviewService.getLikeCount(item.id),
                        reviewService.getComments(item.id),
                    ]);
                    counts[item.id] = { likes: likeCount, comments: comments.length };
                } catch {
                    counts[item.id] = { likes: 0, comments: 0 };
                }
            }));
            setSocialCounts(counts);
        } catch (error) {
            console.error("Error loading reviews:", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const getReviewLink = (item) => {
        if (username) {
            const slug = generateSlugFromTitle(item.title);
            return `/${username}/${slug}-${item.mediaId}`;
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
                <span className="text-sm text-textSecondary">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="space-y-4">
                {reviews.map((item) => (
                    <Link key={item.id} href={getReviewLink(item)} className="block">
                        <div className="bg-secondary rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all">
                            <div className="flex gap-4">
                                <div className="shrink-0">
                                    {item.poster_path ? (
                                        <img
                                            src={`${TMDB_IMG}/w154${item.poster_path}`}
                                            alt={item.title}
                                            className="w-16 h-24 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-16 h-24 rounded-lg bg-white/10 flex items-center justify-center">
                                            <MessageSquare size={16} className="text-white/20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white text-lg leading-tight hover:text-accent transition-colors">{item.title}</h3>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                        {item.rating > 0 && (
                                            <StarRating value={item.rating} size={14} readonly showHalfStars />
                                        )}
                                        {item.liked && (
                                            <Heart size={14} className="text-red-400" fill="currentColor" />
                                        )}
                                        <span className="text-xs text-textSecondary capitalize">{item.mediaType}</span>
                                        {item.ratedAt && (
                                            <span className="text-xs text-textSecondary">{formatDate(item.ratedAt)}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-textSecondary mt-3 whitespace-pre-wrap leading-relaxed line-clamp-3">
                                        {item.review}
                                    </p>
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {item.tags.slice(0, 5).map((tag, i) => (
                                                <span key={i} className="bg-accent/10 text-accent text-[10px] font-medium px-2 py-0.5 rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                            {item.tags.length > 5 && (
                                                <span className="text-[10px] text-textSecondary">+{item.tags.length - 5}</span>
                                            )}
                                        </div>
                                    )}
                                    {/* Social counts */}
                                    {(socialCounts[item.id]?.likes > 0 || socialCounts[item.id]?.comments > 0) && (
                                        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-white/5">
                                            {socialCounts[item.id]?.likes > 0 && (
                                                <div className="flex items-center gap-1 text-xs text-textSecondary">
                                                    <ThumbsUp size={12} />
                                                    <span>{socialCounts[item.id].likes}</span>
                                                </div>
                                            )}
                                            {socialCounts[item.id]?.comments > 0 && (
                                                <div className="flex items-center gap-1 text-xs text-textSecondary">
                                                    <MessageSquare size={12} />
                                                    <span>{socialCounts[item.id].comments}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
