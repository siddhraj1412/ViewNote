"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import { Heart, MessageSquare, EyeOff } from "lucide-react";
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

export default function ReviewCard({ review, href = null, showPoster = true, showUser = true, showText = true }) {
    const { user } = useAuth();
    const [likeCount, setLikeCount] = useState(0);
    const [commentCount, setCommentCount] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);
    const [spoilerRevealed, setSpoilerRevealed] = useState(false);

    const reviewId = review?.id;

    useEffect(() => {
        if (!reviewId) return;

        // Initial fetch
        const fetchCounts = async () => {
            try {
                const { count: likesCount } = await supabase
                    .from("review_likes")
                    .select("*", { count: "exact", head: true })
                    .eq("reviewDocId", reviewId);
                setLikeCount(likesCount || 0);
            } catch { setLikeCount(0); }
            try {
                const { count: commentsCount } = await supabase
                    .from("review_comments")
                    .select("*", { count: "exact", head: true })
                    .eq("reviewDocId", reviewId);
                setCommentCount(commentsCount || 0);
            } catch { setCommentCount(0); }
        };
        fetchCounts();

        // Realtime subscriptions
        const likesChannel = supabase
            .channel(`review_likes_${reviewId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "review_likes", filter: `reviewDocId=eq.${reviewId}` }, () => {
                fetchCounts();
            })
            .subscribe();

        const commentsChannel = supabase
            .channel(`review_comments_${reviewId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "review_comments", filter: `reviewDocId=eq.${reviewId}` }, () => {
                fetchCounts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(likesChannel);
            supabase.removeChannel(commentsChannel);
        };
    }, [reviewId]);

    useEffect(() => {
        if (!reviewId || !user?.uid) {
            setLiked(false);
            return;
        }
        let mounted = true;
        reviewService.hasUserLiked(reviewId, user.uid).then((v) => {
            if (mounted) setLiked(Boolean(v));
        }).catch(() => {
            if (mounted) setLiked(false);
        });
        return () => { mounted = false; };
    }, [reviewId, user?.uid]);

    const computedHref = useMemo(() => {
        if (href) return href;
        const slug = generateSlugFromTitle(review?.title);
        const username = review?.username || review?.userId;
        if (!username || !review?.id) return null;
        return `/${encodeURIComponent(username)}/${slug}-${review.id}`;
    }, [href, review?.mediaId, review?.title, review?.userId, review?.username]);

    const handleToggleLike = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return;
        if (!reviewId || likeLoading) return;

        // Optimistic UI: update immediately
        const prevLiked = liked;
        const prevCount = likeCount;
        setLiked(!prevLiked);
        setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
        setLikeLoading(true);

        try {
            const result = await reviewService.toggleLike(reviewId, user);
            // Sync with server truth
            setLiked(result.liked);
            setLikeCount(result.count);
        } catch {
            // Revert on failure
            setLiked(prevLiked);
            setLikeCount(prevCount);
        } finally {
            setLikeLoading(false);
        }
    }, [user, reviewId, likeLoading, liked, likeCount]);

    const username = review?.username || "";
    const userPhoto = review?.photoURL || review?.userPhotoURL || "";

    const card = (
        <div className="bg-secondary rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all">
            <div className="flex gap-4">
                {showPoster ? (
                    <div className="shrink-0">
                        {review?.poster_path ? (
                            <img
                                src={`${TMDB_IMG}/w154${review.poster_path}`}
                                alt={review?.title || "Poster"}
                                className="w-16 h-24 rounded-lg object-cover"
                            />
                        ) : (
                            <div className="w-16 h-24 rounded-lg bg-white/10 flex items-center justify-center">
                                <MessageSquare size={16} className="text-white/20" />
                            </div>
                        )}
                    </div>
                ) : null}

                <div className="flex-1 min-w-0">
                    {showUser ? (
                        <div className="flex items-center gap-2 mb-2">
                            {userPhoto ? (
                                <img src={userPhoto} alt={username || "User"} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-white/10" />
                            )}
                            <div className="text-sm font-semibold text-white truncate">{username ? `@${username}` : "@user"}</div>
                        </div>
                    ) : null}

                    <div className="font-bold text-white text-lg leading-tight truncate">{review?.title || ""}</div>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {Number(review?.rating || 0) > 0 ? (
                            <StarRating value={Number(review.rating || 0)} size={14} readonly showHalfStars />
                        ) : null}
                        {review?.liked ? (
                            <Heart size={14} className="text-red-400" fill="currentColor" />
                        ) : null}
                    </div>

                    {showText && review?.review ? (
                        review?.spoiler && !spoilerRevealed ? (
                            <div className="relative mt-3">
                                <p className="text-sm text-textSecondary whitespace-pre-wrap leading-relaxed line-clamp-3 blur-sm select-none">
                                    {review.review}
                                </p>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSpoilerRevealed(true); }}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-[11px] text-white hover:bg-white/20 transition-colors"
                                    >
                                        <EyeOff size={11} />
                                        Reveal Spoiler
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-textSecondary mt-3 whitespace-pre-wrap leading-relaxed line-clamp-3">{review.review}</p>
                        )
                    ) : null}

                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={handleToggleLike}
                            disabled={!user || likeLoading}
                            className="flex items-center gap-1.5 text-xs text-textSecondary hover:text-white transition-colors disabled:opacity-60"
                            aria-label={liked ? "Unlike" : "Like"}
                            title={liked ? `You and ${Math.max(0, likeCount - 1)} others liked this` : `Liked by ${likeCount} users`}
                        >
                            <Heart size={14} className={liked ? "text-red-400" : "text-white/50"} fill={liked ? "currentColor" : "none"} />
                            <span className="tabular-nums">{likeCount}</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-textSecondary" title={`${commentCount} comments`}>
                            <MessageSquare size={14} />
                            <span className="tabular-nums">{commentCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (!computedHref) return card;
    return (
        <Link href={computedHref} className="block">
            {card}
        </Link>
    );
}
