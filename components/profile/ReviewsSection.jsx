"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MessageSquare, Heart, Calendar, ThumbsUp, Send, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import supabase from "@/lib/supabase";
import StarRating from "@/components/StarRating";
import { reviewService } from "@/services/reviewService";
import { useAuth } from "@/context/AuthContext";

const TMDB_IMG = "https://image.tmdb.org/t/p";
const PREVIEW_SIZE = 24;

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
    const { user: currentUser } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [sortBy, setSortBy] = useState("newest");
    const [socialCounts, setSocialCounts] = useState({}); // { [reviewId]: { likes: N, comments: N } }
    const [likedByMe, setLikedByMe] = useState({}); // { [reviewId]: bool }
    const [liking, setLiking] = useState({}); // { [reviewId]: bool } – prevent double-clicks
    const [openComments, setOpenComments] = useState({}); // { [reviewId]: bool }
    const [commentsData, setCommentsData] = useState({}); // { [reviewId]: Comment[] }
    const [commentInputs, setCommentInputs] = useState({}); // { [reviewId]: string }
    const [submittingComment, setSubmittingComment] = useState({});

    const fetchReviews = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("userId", userId);

            const items = (data || [])
                .filter((r) => r.review && r.review.trim().length > 0)
                .sort((a, b) => new Date(b.ratedAt || 0).getTime() - new Date(a.ratedAt || 0).getTime());
            setReviews(items);

            // Batch-fetch like states + comment counts (2 queries instead of 2N)
            if (items.length > 0) {
                const ids = items.map((r) => r.id);
                const [likeStates, commentCounts] = await Promise.all([
                    reviewService.getBatchLikeStates(ids, currentUser?.uid),
                    reviewService.getBatchCommentCounts(ids),
                ]);
                const counts = {};
                const myLikes = {};
                for (const id of ids) {
                    counts[id] = {
                        likes: likeStates[id]?.count ?? 0,
                        comments: commentCounts[id] ?? 0,
                    };
                    myLikes[id] = likeStates[id]?.liked ?? false;
                }
                setSocialCounts(counts);
                setLikedByMe(myLikes);
            } else {
                setSocialCounts({});
                setLikedByMe({});
            }
        } catch (error) {
            console.error("Error loading reviews:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, currentUser]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    // ── Interaction handlers ──
    const handleToggleLike = async (reviewId, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser || liking[reviewId]) return;
        setLiking((p) => ({ ...p, [reviewId]: true }));
        try {
            const result = await reviewService.toggleLike(reviewId, currentUser);
            setLikedByMe((p) => ({ ...p, [reviewId]: result.liked }));
            setSocialCounts((p) => ({
                ...p,
                [reviewId]: {
                    ...p[reviewId],
                    likes: (p[reviewId]?.likes || 0) + (result.liked ? 1 : -1),
                },
            }));
        } catch (err) {
            console.error("Like toggle error:", err);
        } finally {
            setLiking((p) => ({ ...p, [reviewId]: false }));
        }
    };

    const handleToggleComments = async (reviewId, e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = !openComments[reviewId];
        setOpenComments((p) => ({ ...p, [reviewId]: isOpen }));
        if (isOpen && !commentsData[reviewId]) {
            try {
                const comments = await reviewService.getComments(reviewId);
                setCommentsData((p) => ({ ...p, [reviewId]: comments }));
            } catch (err) {
                console.error("Load comments error:", err);
            }
        }
    };

    const handleSubmitComment = async (reviewId, e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = (commentInputs[reviewId] || "").trim();
        if (!text || !currentUser || submittingComment[reviewId]) return;
        setSubmittingComment((p) => ({ ...p, [reviewId]: true }));
        try {
            await reviewService.addComment(reviewId, currentUser.uid, currentUser.username || currentUser.displayName || "User", text);
            setCommentInputs((p) => ({ ...p, [reviewId]: "" }));
            // Refresh comments
            const comments = await reviewService.getComments(reviewId);
            setCommentsData((p) => ({ ...p, [reviewId]: comments }));
            setSocialCounts((p) => ({
                ...p,
                [reviewId]: { ...p[reviewId], comments: comments.length },
            }));
        } catch (err) {
            console.error("Submit comment error:", err);
        } finally {
            setSubmittingComment((p) => ({ ...p, [reviewId]: false }));
        }
    };

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
        if (!timestamp) return "";
        return new Date(timestamp).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
        });
    };

    const sortedReviews = useMemo(() => {
        const copy = [...reviews];
        switch (sortBy) {
            case "oldest":
                copy.sort((a, b) => new Date(a.ratedAt || 0).getTime() - new Date(b.ratedAt || 0).getTime());
                break;
            case "a-z":
                copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                break;
            case "z-a":
                copy.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
                break;
            case "rating-high":
                copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case "rating-low":
                copy.sort((a, b) => (a.rating || 0) - (b.rating || 0));
                break;
            case "most-liked":
                copy.sort((a, b) => (socialCounts[b.id]?.likes || 0) - (socialCounts[a.id]?.likes || 0));
                break;
            case "newest":
            default:
                copy.sort((a, b) => new Date(b.ratedAt || 0).getTime() - new Date(a.ratedAt || 0).getTime());
                break;
        }
        return copy;
    }, [reviews, sortBy, socialCounts]);

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
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-background text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="a-z">A → Z</option>
                        <option value="z-a">Z → A</option>
                        <option value="rating-high">Rating ↓</option>
                        <option value="rating-low">Rating ↑</option>
                        <option value="most-liked">Most Liked</option>
                    </select>
                    <span className="text-sm text-textSecondary">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
                </div>
            </div>

            <div className="space-y-4">
                {(showAll ? sortedReviews : sortedReviews.slice(0, PREVIEW_SIZE)).map((item) => (
                    <div key={item.id} className="bg-secondary rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all">
                        <Link href={getReviewLink(item)} className="block">
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
                                </div>
                            </div>
                        </Link>
                        {/* Interactive social bar - outside of Link */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                            {/* Like button */}
                            <button
                                onClick={(e) => handleToggleLike(item.id, e)}
                                disabled={!currentUser || liking[item.id]}
                                className={`flex items-center gap-1.5 text-xs transition-colors ${
                                    likedByMe[item.id]
                                        ? "text-accent"
                                        : "text-textSecondary hover:text-accent"
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                <ThumbsUp
                                    size={14}
                                    className={likedByMe[item.id] ? "fill-accent" : ""}
                                />
                                <span>{socialCounts[item.id]?.likes || 0}</span>
                            </button>
                            {/* Comment toggle */}
                            <button
                                onClick={(e) => handleToggleComments(item.id, e)}
                                className="flex items-center gap-1.5 text-xs text-textSecondary hover:text-blue-400 transition-colors"
                            >
                                <MessageSquare size={14} />
                                <span>{socialCounts[item.id]?.comments || 0}</span>
                                {openComments[item.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        </div>

                        {/* Inline comments panel */}
                        {openComments[item.id] && (
                            <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                                {/* Comment list */}
                                {(commentsData[item.id] || []).length > 0 ? (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {(commentsData[item.id] || []).map((c) => (
                                            <div key={c.id} className="text-xs text-textSecondary">
                                                <span className="font-semibold text-white">{c.username || "User"}</span>{" "}
                                                <span>{c.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-textSecondary/60">No comments yet</p>
                                )}
                                {/* Comment input */}
                                {currentUser && (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={commentInputs[item.id] || ""}
                                            onChange={(e) =>
                                                setCommentInputs((p) => ({ ...p, [item.id]: e.target.value }))
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSubmitComment(item.id, e);
                                            }}
                                            placeholder="Add a comment…"
                                            className="flex-1 bg-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-textSecondary/50 outline-none focus:ring-1 focus:ring-accent/50"
                                        />
                                        <button
                                            onClick={(e) => handleSubmitComment(item.id, e)}
                                            disabled={submittingComment[item.id] || !(commentInputs[item.id] || "").trim()}
                                            className="text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:text-white transition-colors"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {!showAll && reviews.length > PREVIEW_SIZE && (
                <div className="flex justify-center mt-6">
                    <button
                        onClick={() => setShowAll(true)}
                        className="px-6 py-2.5 text-sm font-medium text-accent hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                        Show all {reviews.length} reviews
                    </button>
                </div>
            )}
        </section>
    );
}
