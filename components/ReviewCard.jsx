"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Heart, MessageSquare } from "lucide-react";
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

    const reviewId = review?.id;

    useEffect(() => {
        if (!reviewId) return;

        const likesQ = query(collection(db, "review_likes"), where("reviewDocId", "==", reviewId));
        const commentsQ = query(collection(db, "review_comments"), where("reviewDocId", "==", reviewId));

        const unsubLikes = onSnapshot(likesQ, (snap) => {
            setLikeCount(snap.size);
        }, () => setLikeCount(0));

        const unsubComments = onSnapshot(commentsQ, (snap) => {
            setCommentCount(snap.size);
        }, () => setCommentCount(0));

        return () => {
            try { unsubLikes(); } catch (_) {}
            try { unsubComments(); } catch (_) {}
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
        setLikeLoading(true);
        try {
            const result = await reviewService.toggleLike(reviewId, user);
            setLiked(result.liked);
            setLikeCount(result.count);
        } finally {
            setLikeLoading(false);
        }
    }, [user, reviewId, likeLoading]);

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
                        <p className="text-sm text-textSecondary mt-3 whitespace-pre-wrap leading-relaxed line-clamp-3">{review.review}</p>
                    ) : null}

                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={handleToggleLike}
                            disabled={!user || likeLoading}
                            className="flex items-center gap-1.5 text-xs text-textSecondary hover:text-white transition-colors disabled:opacity-60"
                            aria-label={liked ? "Unlike" : "Like"}
                            title={liked ? "Unlike" : "Like"}
                        >
                            <Heart size={14} className={liked ? "text-red-400" : "text-white/50"} fill={liked ? "currentColor" : "none"} />
                            <span className="tabular-nums">{likeCount}</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-textSecondary">
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
