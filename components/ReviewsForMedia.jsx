"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import StarRating from "@/components/StarRating";
import { Heart, MessageSquare, ChevronDown, Loader2, Send, Trash2 } from "lucide-react";
import eventBus from "@/lib/eventBus";
import { reviewService } from "@/services/reviewService";
import { useAuth } from "@/context/AuthContext";

const TMDB_IMG = "https://image.tmdb.org/t/p";
const REVIEWS_PER_PAGE = 15;

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

function timeAgo(date) {
    if (!date) return "";
    const now = new Date();
    const d = date instanceof Date ? date : date?.toDate?.() || new Date(date?.seconds * 1000);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Inline Like Button ── */
function InlineLikeButton({ reviewId, user }) {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(0);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        reviewService.getReviewLikeState(reviewId, user?.uid).then((s) => {
            if (!cancelled) { setLiked(s.liked); setCount(s.count); }
        });
        return () => { cancelled = true; };
    }, [reviewId, user?.uid]);

    // Listen for like updates from other components
    useEffect(() => {
        const handler = (data) => {
            if (data.reviewDocId === reviewId) {
                setLiked(data.liked);
                setCount(data.count);
            }
        };
        eventBus.on("REVIEW_LIKE_UPDATED", handler);
        return () => eventBus.off("REVIEW_LIKE_UPDATED", handler);
    }, [reviewId]);

    const toggle = async (e) => {
        e.stopPropagation();
        if (!user || busy) return;
        setBusy(true);
        try {
            const result = await reviewService.toggleLike(reviewId, user);
            setLiked(result.liked);
            setCount(result.count);
        } catch { /* ignore */ }
        setBusy(false);
    };

    return (
        <button
            onClick={toggle}
            disabled={busy || !user}
            className={`flex items-center gap-1 text-xs transition-colors ${
                liked ? "text-red-400" : "text-textSecondary hover:text-red-400"
            } disabled:opacity-50`}
            title={user ? (liked ? "Unlike" : "Like") : "Sign in to like"}
        >
            <Heart size={14} fill={liked ? "currentColor" : "none"} />
            {count > 0 && <span>{count}</span>}
        </button>
    );
}

/* ── Inline Comment Section ── */
function InlineComments({ reviewId, user }) {
    const [open, setOpen] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentCount, setCommentCount] = useState(0);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [posting, setPosting] = useState(false);
    const inputRef = useRef(null);

    // Fetch count on mount (lightweight)
    useEffect(() => {
        let cancelled = false;
        reviewService.getComments(reviewId).then((c) => {
            if (!cancelled) { setComments(c); setCommentCount(c.length); }
        });
        return () => { cancelled = true; };
    }, [reviewId]);

    const toggleOpen = (e) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
    };

    const handlePost = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user || !newComment.trim() || posting) return;
        setPosting(true);
        try {
            const added = await reviewService.addComment(reviewId, user, newComment.trim());
            if (added) {
                setComments((prev) => [added, ...prev]);
                setCommentCount((prev) => prev + 1);
                setNewComment("");
            }
        } catch { /* ignore */ }
        setPosting(false);
    };

    const handleDelete = async (commentId, e) => {
        e.stopPropagation();
        if (!user) return;
        const ok = await reviewService.deleteComment(commentId, user.uid);
        if (ok) {
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setCommentCount((prev) => Math.max(0, prev - 1));
        }
    };

    return (
        <div className="mt-3">
            <button
                onClick={toggleOpen}
                className="flex items-center gap-1 text-xs text-textSecondary hover:text-white transition-colors"
            >
                <MessageSquare size={14} />
                {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "Comment"}
            </button>

            {open && (
                <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                    {/* Comment input */}
                    {user ? (
                        <form onSubmit={handlePost} className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write a comment..."
                                maxLength={1000}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-textSecondary focus:outline-none focus:border-accent"
                            />
                            <button
                                type="submit"
                                disabled={posting || !newComment.trim()}
                                className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent/80 transition-colors flex items-center gap-1"
                            >
                                <Send size={12} />
                            </button>
                        </form>
                    ) : (
                        <p className="text-xs text-textSecondary">Sign in to comment.</p>
                    )}

                    {/* Comment list */}
                    {comments.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {comments.map((c) => (
                                <div key={c.id} className="flex gap-2 items-start">
                                    {c.photoURL ? (
                                        <img src={c.photoURL} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-medium text-white">@{c.username || "user"}</span>
                                            <span className="text-[10px] text-textSecondary">{timeAgo(c.createdAt)}</span>
                                        </div>
                                        <p className="text-xs text-textSecondary mt-0.5 break-words">{c.text}</p>
                                    </div>
                                    {user?.uid === c.userId && (
                                        <button
                                            onClick={(e) => handleDelete(c.id, e)}
                                            className="text-textSecondary hover:text-red-400 transition-colors shrink-0"
                                            title="Delete comment"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ReviewsForMedia({ mediaId, mediaType, title, tvTargetType, tvSeasonNumber, tvEpisodeNumber, slug }) {
    const { user } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewSort, setReviewSort] = useState("recent");
    const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState(false);

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
                .filter((r) => {
                    if (!r.review || r.review.trim().length === 0) return false;
                    if (mediaType && r.mediaType !== mediaType) return false;
                    // Filter by target scope for TV content
                    if (tvTargetType === "season" && typeof tvSeasonNumber === "number") {
                        return r.tvTargetType === "season" && r.tvSeasonNumber === tvSeasonNumber;
                    }
                    if (tvTargetType === "episode" && typeof tvSeasonNumber === "number" && typeof tvEpisodeNumber === "number") {
                        return r.tvTargetType === "episode" && r.tvSeasonNumber === tvSeasonNumber && r.tvEpisodeNumber === tvEpisodeNumber;
                    }
                    // For series-level reviews, show only those without season/episode scope
                    if (tvTargetType === "series" || (!tvTargetType && mediaType === "tv")) {
                        return !r.tvTargetType || r.tvTargetType === "series";
                    }
                    return true;
                });
            setReviews(items);
        } catch {
            setReviews([]);
        } finally {
            setLoading(false);
        }
    }, [mediaId, mediaType, tvTargetType, tvSeasonNumber, tvEpisodeNumber]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    // Re-fetch reviews when a media update event fires
    useEffect(() => {
        if (!mediaId) return;
        const handleUpdate = (data) => {
            if (String(data.mediaId) === String(mediaId)) {
                fetchReviews();
            }
        };
        eventBus.on("MEDIA_UPDATED", handleUpdate);
        return () => eventBus.off("MEDIA_UPDATED", handleUpdate);
    }, [mediaId, fetchReviews]);

    // Reset visible count when sort changes
    useEffect(() => {
        setVisibleCount(REVIEWS_PER_PAGE);
    }, [reviewSort]);

    const sortedReviews = useMemo(() => {
        const copy = [...reviews];
        if (reviewSort === "popular") {
            copy.sort((a, b) => {
                const aLikes = Number(a.likeCount || 0);
                const bLikes = Number(b.likeCount || 0);
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
    }, [reviews, reviewSort]);

    const visibleReviews = useMemo(() => sortedReviews.slice(0, visibleCount), [sortedReviews, visibleCount]);
    const hasMore = visibleCount < sortedReviews.length;

    const handleLoadMore = () => {
        setLoadingMore(true);
        // Small delay for visual feedback
        setTimeout(() => {
            setVisibleCount((prev) => prev + REVIEWS_PER_PAGE);
            setLoadingMore(false);
        }, 200);
    };

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
                {visibleReviews.map((r) => {
                    const username = r.username || r.userId;

                    return (
                        <div key={r.id} className="bg-secondary rounded-xl p-5 border border-white/5">
                            {/* Author row */}
                            <div className="flex items-center gap-3 mb-3">
                                {r.photoURL ? (
                                    <img src={r.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-xs text-textSecondary font-medium">
                                        {(username || "?")[0].toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Link
                                        href={`/${encodeURIComponent(username)}`}
                                        className="text-sm font-semibold text-white hover:text-accent transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        @{username}
                                    </Link>
                                    <div className="text-[11px] text-textSecondary">
                                        {timeAgo(r.createdAt || r.ratedAt)}
                                    </div>
                                </div>
                                {r.rating > 0 && (
                                    <div className="ml-auto">
                                        <StarRating value={r.rating} size={14} readonly showHalfStars />
                                    </div>
                                )}
                            </div>

                            {/* Review text */}
                            <p className="text-sm text-textSecondary whitespace-pre-wrap leading-relaxed line-clamp-4">
                                {r.review}
                            </p>

                            {/* Interaction row */}
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                                <InlineLikeButton reviewId={r.id} user={user} />
                                <InlineComments reviewId={r.id} user={user} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Load More / Pagination */}
            {hasMore && (
                <div className="mt-6 flex flex-col items-center gap-3">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-textSecondary hover:text-white transition-all disabled:opacity-50"
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <ChevronDown size={16} />
                                Show More Reviews ({sortedReviews.length - visibleCount} remaining)
                            </>
                        )}
                    </button>
                    {slug && mediaType === "tv" && (
                        <Link
                            href={`/show/${slug}/reviews`}
                            className="text-sm text-accent hover:underline font-medium"
                        >
                            See All Reviews →
                        </Link>
                    )}
                </div>
            )}
        </section>
    );
}
