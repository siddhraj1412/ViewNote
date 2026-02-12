"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import StarRating from "@/components/StarRating";
import { Heart, Calendar, Eye, ArrowLeft, Tag } from "lucide-react";
import Link from "next/link";
import { getMediaUrl } from "@/lib/slugify";

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

    useEffect(() => {
        if (!username || !mediaSlug) return;

        const fetchReview = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Resolve username to userId
                const profilesRef = collection(db, "user_profiles");
                const profileQuery = query(profilesRef, where("username", "==", username));
                const profileSnap = await getDocs(profileQuery);

                if (profileSnap.empty) {
                    setError("User not found");
                    setLoading(false);
                    return;
                }

                const profileDoc = profileSnap.docs[0];
                const userId = profileDoc.data().userId || profileDoc.id;
                setProfileData(profileDoc.data());

                // 2. Find review by mediaSlug from user_ratings (check title match)
                const ratingsRef = collection(db, "user_ratings");
                const ratingsQuery = query(ratingsRef, where("userId", "==", userId));
                const ratingsSnap = await getDocs(ratingsQuery);

                // Find a review matching this slug
                let matchedReview = null;
                for (const doc of ratingsSnap.docs) {
                    const data = doc.data();
                    // Generate slug from stored title for matching
                    const titleSlug = generateSlugFromTitle(data.title || "");
                    const slugWithId = `${titleSlug}-${data.mediaId}`;
                    if (slugWithId === mediaSlug || titleSlug === mediaSlug) {
                        matchedReview = { id: doc.id, ...data };
                        break;
                    }
                }

                if (!matchedReview) {
                    // Try matching by just mediaId at the end of slug
                    const idMatch = mediaSlug.match(/-(\d+)$/);
                    if (idMatch) {
                        const mediaId = parseInt(idMatch[1]);
                        for (const doc of ratingsSnap.docs) {
                            const data = doc.data();
                            if (data.mediaId === mediaId) {
                                matchedReview = { id: doc.id, ...data };
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent" />
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
        : review.ratedAt?.toDate
            ? review.ratedAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : null;

    const mediaUrl = getMediaUrl(
        { id: review.mediaId, title: review.title, name: review.title },
        review.mediaType
    );

    return (
        <div className="min-h-screen">
            <div className="container py-8 md:py-12 max-w-3xl mx-auto">
                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-textSecondary hover:text-white transition mb-8"
                >
                    <ArrowLeft size={18} />
                    <span>Back</span>
                </button>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Poster */}
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

                    {/* Review content */}
                    <div className="flex-1 space-y-5 min-w-0">
                        {/* Title */}
                        <div>
                            <Link href={mediaUrl} className="hover:text-accent transition">
                                <h1 className="text-2xl md:text-3xl font-bold text-white">{review.title}</h1>
                            </Link>
                            <p className="text-textSecondary text-sm mt-1 capitalize">{review.mediaType}</p>
                        </div>

                        {/* Reviewer info */}
                        <div className="flex items-center gap-3">
                            {profileData?.photoURL && (
                                <img
                                    src={profileData.photoURL}
                                    alt={username}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            )}
                            <Link href={`/${username}`} className="text-sm text-accent hover:underline font-medium">
                                @{username}
                            </Link>
                        </div>

                        {/* Rating + Like row */}
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
                            {review.viewCount > 1 && (
                                <div className="flex items-center gap-1 text-sm text-textSecondary">
                                    <Eye size={14} />
                                    <span>Watched {review.viewCount}x</span>
                                </div>
                            )}
                        </div>

                        {/* Date */}
                        {watchedDate && (
                            <div className="flex items-center gap-2 text-sm text-textSecondary">
                                <Calendar size={14} />
                                <span>Watched on {watchedDate}</span>
                            </div>
                        )}

                        {/* Review text */}
                        {review.review && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-white leading-relaxed whitespace-pre-wrap">{review.review}</p>
                            </div>
                        )}

                        {/* Tags */}
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
                    </div>
                </div>
            </div>
        </div>
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
