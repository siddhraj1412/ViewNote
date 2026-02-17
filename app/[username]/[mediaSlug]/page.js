"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import StarRating from "@/components/StarRating";
import { Heart, Calendar, Eye, ArrowLeft, Tag, MessageCircle, Send, Trash2, ThumbsUp, Edit3 } from "lucide-react";
import Link from "next/link";
import { getMediaUrl } from "@/lib/slugify";
import { reviewService } from "@/services/reviewService";
import showToast from "@/lib/toast";
import dynamic from "next/dynamic";

const RatingModal = dynamic(() => import("@/components/RatingModal"), { ssr: false, loading: () => null });

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const TMDB_IMG_LG = "https://image.tmdb.org/t/p/w500";

export default function ReviewDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const username = decodeURIComponent(params.username || "");
    const mediaSlug = decodeURIComponent(params.mediaSlug || "");

    const [review, setReview] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Like state
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [likeLoading, setLikeLoading] = useState(false);

    // Comment state
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [commentLoading, setCommentLoading] = useState(false);
    const [deletingComment, setDeletingComment] = useState(null);
    const [reviewOwnerId, setReviewOwnerId] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        if (!username || !mediaSlug) return;

        const fetchReview = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data: profiles, error: profileError } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("username", username);

                if (profileError || !profiles || profiles.length === 0) {
                    setError("User not found");
                    setLoading(false);
                    return;
                }

                const profileDoc = profiles[0];
                const userId = profileDoc.userId || profileDoc.id;
                setProfileData(profileDoc);
                setReviewOwnerId(userId);

                const { data: ratingsData } = await supabase
                    .from("user_ratings")
                    .select("*")
                    .eq("userId", userId);
                const ratings = ratingsData || [];

                let matchedReview = null;
                const docIdSuffix = mediaSlug.split("-").pop();
                if (docIdSuffix) {
                    for (const d of ratings) {
                        if (d.id === docIdSuffix) {
                            matchedReview = d;
                            break;
                        }
                    }
                }

                if (!matchedReview) {
                for (const item of ratings) {
                    const titleSlug = generateSlugFromTitle(item.title || "");
                    const slugWithId = `${titleSlug}-${item.mediaId}`;
                    if (slugWithId === mediaSlug || titleSlug === mediaSlug) {
                        matchedReview = item;
                        break;
                    }
                }
                }

                if (!matchedReview) {
                    const idMatch = mediaSlug.match(/-(\d+)$/);
                    if (idMatch) {
                        const mediaId = parseInt(idMatch[1]);
                        for (const item of ratings) {
                            if (item.mediaId === mediaId) {
                                matchedReview = item;
                                break;
                            }
                        }
                    }
                }

                if (!matchedReview) {
                    setError("Review not found");
                    setLoading(false);
                    return;
                }

                setReview(matchedReview);
            } catch (err) {
                console.error("Error fetching review:", err);
                setError("Failed to load review");
            } finally {
                setLoading(false);
            }
        };

        fetchReview();
    }, [username, mediaSlug]);

    // Load likes and comments once review is loaded
    useEffect(() => {
        if (!review?.id) return;
        reviewService.getReviewLikeState(review.id, user?.uid).then(({ liked: l, count }) => {
            setLiked(l);
            setLikeCount(count);
        });
        reviewService.getComments(review.id).then(setComments);

        const fetchLikesCount = async () => {
            const { count } = await supabase
                .from("review_likes")
                .select("*", { count: "exact", head: true })
                .eq("reviewDocId", review.id);
            setLikeCount(count || 0);
        };

        const fetchComments = async () => {
            const { data } = await supabase
                .from("review_comments")
                .select("*")
                .eq("reviewDocId", review.id)
                .order("createdAt", { ascending: false });
            const next = (data || []).map((d) => ({
                ...d,
                createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            }));
            const unique = new Map();
            for (const c of next) unique.set(String(c.id), c);
            setComments(Array.from(unique.values()));
        };

        fetchLikesCount();
        fetchComments();

        const likesChannel = supabase
            .channel(`review-likes-${review.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "review_likes", filter: `reviewDocId=eq.${review.id}` }, () => {
                fetchLikesCount();
            })
            .subscribe();

        const commentsChannel = supabase
            .channel(`review-comments-${review.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "review_comments", filter: `reviewDocId=eq.${review.id}` }, () => {
                fetchComments();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(likesChannel);
            supabase.removeChannel(commentsChannel);
        };
    }, [review?.id, user?.uid]);

    const handleToggleLike = useCallback(async () => {
        if (!user) { showToast.info("Please sign in to like"); return; }
        if (!review?.id || likeLoading) return;

        // Optimistic UI: update immediately
        const prevLiked = liked;
        const prevCount = likeCount;
        setLiked(!prevLiked);
        setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
        setLikeLoading(true);

        try {
            const result = await reviewService.toggleLike(review.id, user);
            setLiked(result.liked);
            setLikeCount(result.count);
        } catch {
            // Revert on failure
            setLiked(prevLiked);
            setLikeCount(prevCount);
            showToast.error("Failed to update like");
        } finally {
            setLikeLoading(false);
        }
    }, [user, review?.id, likeLoading, liked, likeCount]);

    const handleAddComment = useCallback(async () => {
        if (!user) { showToast.info("Please sign in to comment"); return; }
        if (!commentText.trim() || !review?.id || commentLoading) return;
        setCommentLoading(true);
        try {
            const newComment = await reviewService.addComment(review.id, user, commentText);
            if (newComment) {
                setComments(prev => [newComment, ...prev.filter(c => String(c.id) !== String(newComment.id))]);
                setCommentText("");
            }
        } catch {
            showToast.error("Failed to post comment");
        } finally {
            setCommentLoading(false);
        }
    }, [user, review?.id, commentText, commentLoading]);

    const handleDeleteComment = useCallback(async (commentId) => {
        if (!user || deletingComment) return;
        setDeletingComment(commentId);
        try {
            const deleted = await reviewService.deleteComment(commentId, user.uid);
            if (deleted) {
                setComments(prev => prev.filter(c => c.id !== commentId));
            } else {
                showToast.error("Cannot delete this comment");
            }
        } catch {
            showToast.error("Failed to delete comment");
        } finally {
            setDeletingComment(null);
        }
    }, [user, deletingComment]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-textSecondary text-lg">{error}</p>
                <button onClick={() => router.back()} className="text-accent hover:underline">
                    Go back
                </button>
            </div>
        );
    }

    if (!review) return null;

    const watchedDate = review.watchedDate
        ? new Date(review.watchedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : review.ratedAt
            ? new Date(review.ratedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : null;

    const mediaUrl = getMediaUrl(
        { id: review.mediaId, title: review.title, name: review.title },
        review.mediaType
    );

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="site-container py-10">
                <button
                    onClick={() => router.back()}
                    className="mb-6 text-sm text-textSecondary hover:text-white transition-colors flex items-center gap-2"
                >
                    <ArrowLeft size={16} />
                    Back
                </button>

                <div className="flex flex-col md:flex-row gap-8">
                    {review.poster_path && (
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            <Link href={mediaUrl}>
                                <img
                                    src={`${TMDB_IMG_LG}${review.poster_path}`}
                                    alt={review.title}
                                    className="w-[160px] md:w-[200px] rounded-xl object-cover shadow-lg hover:opacity-90 transition"
                                />
                            </Link>
                        </div>
                    )}

                    <div className="flex-1 space-y-5 min-w-0">
                        <div>
                            <Link href={mediaUrl} className="hover:text-accent transition">
                                <h1 className="text-2xl md:text-3xl font-bold text-white">{review.title}</h1>
                            </Link>
                            <p className="text-textSecondary text-sm mt-1 capitalize">{review.mediaType}</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {(profileData?.profile_picture_url || profileData?.photoURL) && (
                                <img
                                    src={profileData.profile_picture_url || profileData.photoURL}
                                    alt={username}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            )}
                            <Link href={`/${username}`} className="text-sm text-accent hover:underline font-medium">
                                @{username}
                            </Link>
                            {user?.uid === reviewOwnerId && (
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-textSecondary hover:text-white transition-all"
                                >
                                    <Edit3 size={14} />
                                    Edit
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {review.rating > 0 && (
                                <div className="flex items-center gap-2">
                                    <StarRating value={review.rating} size={22} readonly showHalfStars />
                                    <span className="text-sm text-textSecondary">{review.rating.toFixed(1)}</span>
                                </div>
                            )}
                            {review.liked && (
                                <Heart size={18} className="text-red-400" fill="currentColor" />
                            )}
                            {(review.viewCount || 1) >= 1 && (
                                <div className="flex items-center gap-1 text-sm text-textSecondary">
                                    <Eye size={14} />
                                    <span>Watched {review.viewCount || 1}x</span>
                                </div>
                            )}
                        </div>

                        {watchedDate && (
                            <div className="flex items-center gap-2 text-sm text-textSecondary">
                                <Calendar size={14} />
                                <span>Watched on {watchedDate}</span>
                            </div>
                        )}

                        {review.review && (
                            <div>
                                <p className="text-white leading-relaxed whitespace-pre-wrap break-words">{review.review}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-4 pt-2 border-t border-white/10">
                            <button
                                onClick={handleToggleLike}
                                disabled={likeLoading}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${liked
                                    ? "bg-accent/20 text-accent border border-accent/30"
                                    : "bg-white/5 text-textSecondary hover:text-white border border-white/10 hover:border-white/20"
                                    }`}
                            >
                                <ThumbsUp size={16} fill={liked ? "currentColor" : "none"} />
                                <span className="tabular-nums">{likeCount}</span>
                                <span>{liked ? "Liked" : "Like"}</span>
                            </button>
                            <div className="flex items-center gap-2 text-sm text-textSecondary">
                                <MessageCircle size={16} />
                                <span className="tabular-nums">{comments.length}</span>
                                <span>Comment{comments.length !== 1 ? "s" : ""}</span>
                            </div>
                        </div>

                        {review.tags && review.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {review.tags.map((tag, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs font-medium px-2.5 py-1 rounded-full"
                                    >
                                        <Tag size={10} />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Comments section */}
                        <div className="space-y-4 pt-2">
                            {/* Comment input */}
                            {user && (
                                <div className="flex gap-3">
                                    <img
                                        src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "U")}&background=random`}
                                        alt="You"
                                        className="w-8 h-8 rounded-full object-cover shrink-0 mt-1"
                                    />
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            type="text"
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                                            placeholder="Add a comment..."
                                            maxLength={1000}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-textSecondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
                                        />
                                        <button
                                            onClick={handleAddComment}
                                            disabled={commentLoading || !commentText.trim()}
                                            className="p-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Comment list */}
                            {comments.length > 0 && (
                                <div className="space-y-3">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-3 group">
                                            <Link href={`/${comment.username || comment.userId}`}>
                                                <img
                                                    src={comment.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || "U")}&background=random`}
                                                    alt={comment.username || "User"}
                                                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                                                />
                                            </Link>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <Link href={`/${comment.username || comment.userId}`} className="text-sm font-medium text-white hover:text-accent transition">
                                                        @{comment.username || "user"}
                                                    </Link>
                                                    <span className="text-[10px] text-textSecondary">
                                                        {comment.createdAt instanceof Date
                                                            ? comment.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                                            : ""}
                                                    </span>
                                                    {user?.uid === comment.userId && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            disabled={deletingComment === comment.id}
                                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition p-0.5"
                                                            title="Delete comment"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-sm text-textSecondary mt-0.5">{comment.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showEditModal && review && (
                <RatingModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    mediaId={review.mediaId}
                    mediaType={review.mediaType}
                    title={review.title}
                    poster_path={review.poster_path}
                    currentRating={review.rating}
                    mode="edit"
                />
            )}
        </main>
    );
}

// Simple slug generator (matches slugify.js logic)
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
