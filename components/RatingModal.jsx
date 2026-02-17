"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/StarRating";
import Button from "@/components/ui/Button";
import { mediaService } from "@/services/mediaService";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import { Heart, X as XIcon, Calendar, EyeOff } from "lucide-react";

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

function normalizeRating(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    const rounded = Math.round(n * 2) / 2;
    const clamped = Math.max(0.5, Math.min(5, rounded));
    return clamped;
}

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
    currentRating,
    releaseYear,
    mode = "normal",
    seasons = [],
    seriesId = null,
    initialSeasonNumber = null,
    initialEpisodeNumber = null,
}) {
    const [rating, setRating] = useState(currentRating);
    const [review, setReview] = useState("");
    const [watchedDate, setWatchedDate] = useState(formatDateForInput(new Date()));
    const [liked, setLiked] = useState(false);
    const [viewCount, setViewCount] = useState(1);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [spoiler, setSpoiler] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(false);
    const [hasExisting, setHasExisting] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState("all");
    const [selectedEpisode, setSelectedEpisode] = useState("all");
    const [showWatchingPrompt, setShowWatchingPrompt] = useState(false);
    const [pendingWatchingPayload, setPendingWatchingPayload] = useState(null);
    const { user } = useAuth();

    const isTV = mediaType === "tv";

    // Load existing review data when modal opens
    useEffect(() => {
        if (!isOpen || !user || !mediaId) return;
        let cancelled = false;

        const loadExisting = async () => {
            setLoadingExisting(true);
            try {
                const existing = await mediaService.getReview(user, mediaId, mediaType, {
                    targetType: isTV ? (selectedSeason === "all" ? "series" : selectedEpisode === "all" ? "season" : "episode") : null,
                    seriesId: isTV ? Number(seriesId ?? mediaId) : null,
                    seasonNumber: isTV && selectedSeason !== "all" ? Number(selectedSeason) : null,
                    episodeNumber: isTV && selectedSeason !== "all" && selectedEpisode !== "all" ? Number(selectedEpisode) : null,
                });
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
                        if (typeof existing.spoiler === "boolean") setSpoiler(existing.spoiler);
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
    }, [isOpen, user, mediaId, mediaType, mode, selectedSeason, selectedEpisode, seriesId]);

    // Sync currentRating prop
    useEffect(() => {
        if (currentRating > 0) setRating(currentRating);
    }, [currentRating]);

    // Reset tag input on close
    useEffect(() => {
        if (!isOpen) setTagInput("");
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        if (isTV) {
            if (initialSeasonNumber == null) {
                setSelectedSeason("all");
                setSelectedEpisode("all");
            } else {
                setSelectedSeason(String(initialSeasonNumber));
                if (initialEpisodeNumber == null) {
                    setSelectedEpisode("all");
                } else {
                    setSelectedEpisode(String(initialEpisodeNumber));
                }
            }
        }
    }, [isOpen, isTV, initialSeasonNumber, initialEpisodeNumber]);

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
        if (loading || loadingExisting) return;
        if (!user) {
            showToast.error("You must be logged in");
            return;
        }

        // Allow zero-star reviews (no rating) — only validate if rating > 0
        const normalizedRating = rating > 0 ? normalizeRating(rating) : 0;
        if (normalizedRating > 0 && (!Number.isFinite(normalizedRating) || normalizedRating < 0.5 || normalizedRating > 5)) {
            showToast.error("Please select a rating from 0.5 to 5.0");
            return;
        }

        setLoading(true);
        try {
            const tvSeriesId = isTV ? Number(seriesId ?? mediaId) : null;
            const seasonNumber = isTV && selectedSeason !== "all" ? Number(selectedSeason) : null;
            const episodeNumber = isTV && seasonNumber != null && selectedEpisode !== "all" ? Number(selectedEpisode) : null;
            const targetType = !isTV
                ? null
                : seasonNumber == null
                    ? "series"
                    : episodeNumber == null
                        ? "season"
                        : "episode";

            const seasonEpisodeCounts = isTV
                ? Object.fromEntries((seasons || [])
                    .filter((s) => s && typeof s.season_number === "number" && s.season_number > 0)
                    .map((s) => [String(s.season_number), Number(s.episode_count || 0)]))
                : null;
            const totalSeasons = isTV
                ? (seasons || []).filter((s) => s && typeof s.season_number === "number" && s.season_number > 0).length
                : null;

            await mediaService.rateMedia(user, mediaId, mediaType, normalizedRating, { title, poster_path }, review.trim(), {
                watchedDate,
                liked,
                viewCount,
                tags,
                spoiler: review.trim() ? spoiler : false,
                rateAgain: mode === "rateAgain",
                targetType,
                seriesId: tvSeriesId,
                seasonNumber,
                episodeNumber,
                totalSeasons,
                seasonEpisodeCounts,
            });

            if (isTV && (targetType === "season" || targetType === "episode")) {
                try {
                    const watching = await mediaService.isWatching(user, tvSeriesId);
                    if (!watching) {
                        setPendingWatchingPayload({
                            seriesId: tvSeriesId,
                            data: {
                                title,
                                poster_path,
                                currentSeason: seasonNumber,
                                currentEpisode: targetType === "episode" ? episodeNumber : null,
                            },
                        });
                        setShowWatchingPrompt(true);
                    }
                } catch (_) {}
            }
            if (!(isTV && (targetType === "season" || targetType === "episode"))) {
                onClose();
            }
        } catch (err) {
            console.error("[RatingModal] Rating error:", err);
            showToast.error("Failed to save rating");
        } finally {
            setLoading(false);
        }
        // Always close on non-TV or when watching prompt isn't shown
        // (TV season/episode with watching prompt is handled by prompt handlers)
    };

    const handleConfirmAddWatching = async () => {
        if (!user || !pendingWatchingPayload?.seriesId) {
            setShowWatchingPrompt(false);
            setPendingWatchingPayload(null);
            onClose();
            return;
        }
        try {
            await mediaService.addToWatching(user, pendingWatchingPayload.seriesId, pendingWatchingPayload.data);
        } catch (_) {
            // ignore
        } finally {
            setShowWatchingPrompt(false);
            setPendingWatchingPayload(null);
            onClose();
        }
    };

    const handleDeclineAddWatching = () => {
        setShowWatchingPrompt(false);
        setPendingWatchingPayload(null);
        onClose();
    };

    const handleRemove = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const tvSeriesId = isTV ? Number(seriesId ?? mediaId) : null;
            const seasonNumber = isTV && selectedSeason !== "all" ? Number(selectedSeason) : null;
            const episodeNumber = isTV && seasonNumber != null && selectedEpisode !== "all" ? Number(selectedEpisode) : null;
            const targetType = !isTV
                ? null
                : seasonNumber == null
                    ? "series"
                    : episodeNumber == null
                        ? "season"
                        : "episode";

            let keepWatchedIfNotCompleted = null;
            if (isTV && (targetType === "series" || targetType === "season" || targetType === "episode")) {
                const label = targetType === "series"
                    ? title
                    : targetType === "season"
                        ? `Season ${seasonNumber}`
                        : `Season ${seasonNumber} Episode ${episodeNumber}`;
                const watched = window.confirm(`Did you watch ${label}?\n\nOK = Yes (keep in Watched)\nCancel = No (remove from Watched)`);
                keepWatchedIfNotCompleted = watched;
            }

            await mediaService.removeRating(user, mediaId, mediaType, {
                targetType,
                seriesId: tvSeriesId,
                seasonNumber,
                episodeNumber,
                keepWatchedIfNotCompleted,
            });
            onClose();
        } catch (err) {
            showToast.error("Failed to remove rating. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getRatingLabel = (value) => {
        if (value === 0) return "";
        return RATING_LABELS[value] || "";
    };

    return (
        <>
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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-textSecondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 resize-none transition-all"
                                />
                                <p className="text-xs text-textSecondary/50 mt-0.5 text-right">
                                    {review.length}/2000
                                </p>
                                {review.trim().length > 0 && (
                                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none group/spoiler">
                                        <input
                                            type="checkbox"
                                            checked={spoiler}
                                            onChange={(e) => setSpoiler(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent/30 focus:ring-1 accent-[var(--accent)]"
                                        />
                                        <EyeOff size={13} className="text-textSecondary group-hover/spoiler:text-white transition-colors" />
                                        <span className="text-xs text-textSecondary group-hover/spoiler:text-white transition-colors">Contains spoiler</span>
                                    </label>
                                )}
                            </div>

                            {isTV && (seasons || []).length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-textSecondary mb-1.5">Season</label>
                                        <select
                                            value={selectedSeason}
                                            onChange={(e) => { setSelectedSeason(e.target.value); setSelectedEpisode("all"); }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all [color-scheme:dark]"
                                        >
                                            <option value="all">All Seasons</option>
                                            {(seasons || [])
                                                .filter((s) => s && typeof s.season_number === "number" && s.season_number >= 0)
                                                .sort((a, b) => {
                                                    const an = Number(a?.season_number ?? 0);
                                                    const bn = Number(b?.season_number ?? 0);
                                                    const aIsSpecial = an === 0;
                                                    const bIsSpecial = bn === 0;
                                                    if (aIsSpecial && !bIsSpecial) return 1;
                                                    if (!aIsSpecial && bIsSpecial) return -1;
                                                    return an - bn;
                                                })
                                                .map((s) => (
                                                    <option key={s.season_number} value={String(s.season_number)}>
                                                        Season {s.season_number}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    {selectedSeason !== "all" && (
                                        <div>
                                            <label className="block text-sm text-textSecondary mb-1.5">Episode</label>
                                            <select
                                                value={selectedEpisode}
                                                onChange={(e) => setSelectedEpisode(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all [color-scheme:dark]"
                                            >
                                                <option value="all">All Episodes</option>
                                                {(() => {
                                                    const seasonObj = (seasons || []).find((s) => String(s.season_number) === String(selectedSeason));
                                                    const epCount = Number(seasonObj?.episode_count || 0);
                                                    return Array.from({ length: epCount }, (_, i) => i + 1).map((n) => (
                                                        <option key={n} value={String(n)}>
                                                            Episode {n}
                                                        </option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                disabled={loading || loadingExisting}
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

            <Modal isOpen={showWatchingPrompt} onClose={handleDeclineAddWatching} title="Add to Watching?" maxWidth="520px">
                <div className="p-6 space-y-5">
                    <p className="text-textSecondary">
                        You rated a season/episode. Do you want to add this series to <span className="text-white font-semibold">Watching</span>?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={handleDeclineAddWatching}
                            className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-textSecondary hover:text-white transition"
                        >
                            Not now
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmAddWatching}
                            className="px-4 py-2 rounded-lg bg-accent text-black font-semibold hover:opacity-90 transition"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
