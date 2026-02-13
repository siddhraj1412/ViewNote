"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/StarRating";
import Button from "@/components/ui/Button";
import { mediaService } from "@/services/mediaService";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import { Heart, X as XIcon, Calendar } from "lucide-react";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

const RATING_LABELS = {
    0.5: "Didn't work",
    1.0: "Very Poor",
    1.5: "Poor",
    2.0: "Weak",
    2.5: "Mixed",
    3.0: "Decent",
    3.5: "Good",
    4.0: "Very Good",
    4.5: "Outstanding",
    5.0: "Exceptional",
};

function formatDateForInput(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split("T")[0];
}

export default function RatingModal({
    isOpen,
    onClose,
    mediaId,
    mediaType,
    title,
    poster_path,
    currentRating = 0,
    releaseYear = "",
    mode = "normal", // "normal" | "edit" | "rateAgain"
}) {
    const [rating, setRating] = useState(currentRating);
    const [review, setReview] = useState("");
    const [watchedDate, setWatchedDate] = useState(formatDateForInput(new Date()));
    const [liked, setLiked] = useState(false);
    const [viewCount, setViewCount] = useState(1);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(false);
    const [hasExisting, setHasExisting] = useState(false);
    const { user } = useAuth();

    // Load existing review data when modal opens
    useEffect(() => {
        if (!isOpen || !user || !mediaId) return;
        let cancelled = false;

        const loadExisting = async () => {
            setLoadingExisting(true);
            try {
                const existing = await mediaService.getReview(user, mediaId, mediaType);
                if (!cancelled && existing) {
                    setHasExisting(true);
                    if (mode === "rateAgain") {
                        // Rate Again: start fresh but increment view count
                        setReview("");
                        setRating(0);
                        setWatchedDate(formatDateForInput(new Date()));
                        setLiked(false);
                        setViewCount((existing.viewCount || 1) + 1);
                        setTags([]);
                    } else {
                        // Normal or Edit: load existing data
                        setReview(existing.review || "");
                        if (existing.rating) setRating(existing.rating);
                        if (existing.watchedDate) setWatchedDate(formatDateForInput(existing.watchedDate));
                        if (typeof existing.liked === "boolean") setLiked(existing.liked);
                        if (existing.viewCount > 0) setViewCount(existing.viewCount);
                        if (Array.isArray(existing.tags)) setTags(existing.tags);
                    }
                } else {
                    setHasExisting(false);
                }
            } catch {
                // ignore
            } finally {
                if (!cancelled) setLoadingExisting(false);
            }
        };

        loadExisting();
        return () => { cancelled = true; };
    }, [isOpen, user, mediaId, mediaType]);

    // Sync currentRating prop
    useEffect(() => {
        if (currentRating > 0) setRating(currentRating);
    }, [currentRating]);

    // Reset tag input on close
    useEffect(() => {
        if (!isOpen) setTagInput("");
    }, [isOpen]);

    const handleAddTag = useCallback(() => {
        const t = tagInput.trim().toLowerCase();
        if (t && !tags.includes(t) && tags.length < 10) {
            setTags(prev => [...prev, t]);
            setTagInput("");
        }
    }, [tagInput, tags]);

    const handleTagKeyDown = (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            handleAddTag();
        }
        if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
            setTags(prev => prev.slice(0, -1));
        }
    };

    const removeTag = (index) => {
        setTags(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!user) {
            showToast.error("You must be logged in");
            return;
        }

        setLoading(true);
        try {
            await mediaService.rateMedia(user, mediaId, mediaType, rating, { title, poster_path }, review.trim(), {
                watchedDate,
                liked,
                viewCount,
                tags,
                rateAgain: mode === "rateAgain",
            });
            onClose();
        } catch (err) {
            // Error handling in service
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await mediaService.removeRating(user, mediaId, mediaType);
            onClose();
        } catch (err) {
            // Error handled in service
        } finally {
            setLoading(false);
        }
    };

    const getRatingLabel = (value) => {
        if (value === 0) return "";
        return RATING_LABELS[value] || "";
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === "rateAgain" ? "Rate Again" : mode === "edit" ? "Edit Review" : "I watched..."} maxWidth="700px">
            <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left – Poster */}
                    {poster_path && (
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            <img
                                src={`${TMDB_IMG}${poster_path}`}
                                alt={title}
                                className="w-[140px] md:w-[180px] rounded-xl object-cover shadow-lg"
                            />
                        </div>
                    )}

                    {/* Right – Form */}
                    <div className="flex-1 space-y-5 min-w-0">
                        {/* Title + Year */}
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">
                                {title}
                                {releaseYear && (
                                    <span className="text-textSecondary font-normal ml-2">({releaseYear})</span>
                                )}
                            </h3>
                        </div>

                        {/* Watched Date */}
                        <div>
                            <label className="flex items-center gap-2 text-sm text-textSecondary mb-1.5">
                                <Calendar size={14} />
                                Watched on
                            </label>
                            <input
                                type="date"
                                value={watchedDate}
                                onChange={(e) => setWatchedDate(e.target.value)}
                                max={formatDateForInput(new Date())}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all [color-scheme:dark]"
                            />
                        </div>

                        {/* Review */}
                        <div>
                            <label className="block text-sm text-textSecondary mb-1.5">
                                Review <span className="text-textSecondary/50">(optional)</span>
                            </label>
                            <textarea
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                                placeholder="Share your thoughts..."
                                rows={3}
                                maxLength={2000}
                                disabled={loadingExisting}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-textSecondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 resize-none transition-all"
                            />
                            <p className="text-xs text-textSecondary/50 mt-0.5 text-right">
                                {review.length}/2000
                            </p>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-sm text-textSecondary mb-1.5">
                                Tags <span className="text-textSecondary/50">(optional, max 10)</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-h-[38px] focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 transition-all">
                                {tags.map((tag, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 bg-accent/20 text-accent text-xs font-medium px-2 py-0.5 rounded-full">
                                        {tag}
                                        <button onClick={() => removeTag(i)} className="hover:text-white transition">
                                            <XIcon size={12} />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    onBlur={handleAddTag}
                                    placeholder={tags.length === 0 ? "Add tags..." : ""}
                                    className="flex-1 min-w-[80px] bg-transparent text-sm text-white placeholder-textSecondary/50 outline-none"
                                    disabled={tags.length >= 10}
                                />
                            </div>
                        </div>

                        {/* Rating + Like + View Count row */}
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Star Rating */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    <StarRating
                                        value={rating}
                                        onChange={setRating}
                                        size={28}
                                        showHalfStars={true}
                                    />
                                    {rating > 0 && (
                                        <button
                                            onClick={() => setRating(0)}
                                            className="p-1 rounded-full bg-white/5 border border-white/10 text-textSecondary hover:text-white hover:bg-white/10 transition-all"
                                            title="Clear rating"
                                        >
                                            <XIcon size={14} />
                                        </button>
                                    )}
                                    {rating > 0 && (
                                        <span className="text-sm text-textSecondary whitespace-nowrap">{getRatingLabel(rating)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Like toggle */}
                            <button
                                onClick={() => setLiked(!liked)}
                                className={`p-2 rounded-full border transition-all ${liked
                                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                                    : "bg-white/5 border-white/10 text-textSecondary hover:text-white"
                                    }`}
                                title={liked ? "Liked" : "Like"}
                            >
                                <Heart size={18} fill={liked ? "currentColor" : "none"} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? "Saving..." : mode === "rateAgain" ? "Save New Review" : currentRating > 0 ? "Update" : "Save"}
                            </Button>
                        </div>
                        {currentRating > 0 && (
                            <button onClick={handleRemove} disabled={loading} className="w-full text-center text-sm text-red-400 hover:text-red-300 transition-colors">
                                Remove Rating
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
