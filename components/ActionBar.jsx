"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import { mediaService } from "@/services/mediaService";
import eventBus from "@/lib/eventBus";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import Modal from "@/components/ui/Modal";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import {
    Eye,
    Star,
    Bookmark,
    MoreHorizontal,
    Pause,
    X,
    Image as ImageIcon,
    Share2,
    Check,
    ListPlus,
    Edit3,
    RefreshCw,
    Tv
} from "lucide-react";
import Button from "@/components/ui/Button";

// Lazy load heavy interaction components
const RatingModal = dynamic(() => import("@/components/RatingModal"), {
    ssr: false,
    loading: () => null
});
const PosterSelector = dynamic(() => import("@/components/PosterSelector"), {
    ssr: false,
    loading: () => null
});
const BannerSelector = dynamic(() => import("@/components/BannerSelector"), {
    ssr: false,
    loading: () => null
});
const AddToListModal = dynamic(() => import("@/components/AddToListModal"), {
    ssr: false,
    loading: () => null
});

export default function ActionBar({
    mediaId,
    mediaType,
    title,
    posterPath,
    bannerPath = null,
    currentRating = 0,
    releaseYear = "",
    seasons = [],
    tvTargetType = "series",
    tvSeasonNumber = null,
    tvEpisodeNumber = null,
    seasonEpisodeCounts = null,
    disableCustomization = false,
    allowPosterCustomization = true,
    allowBannerCustomization = true,
    customizationMediaId = null,
    customizationMediaType = null,
    customizationPosterPath = null,
    customizationBannerPath = null,
    posterTmdbEndpoint = null,
    bannerTmdbEndpoint = null,
    initialSeasonNumber = null,
    initialEpisodeNumber = null,
}) {
    const { user } = useAuth();

    // Consolidated State
    const [status, setStatus] = useState({
        isWatched: false,
        isWatchlist: false,
        isPaused: false,
        isDropped: false,
        isWatching: false,
        rating: currentRating,
        hasEntry: currentRating > 0,
    });
    const [loading, setLoading] = useState(true);

    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingMode, setRatingMode] = useState("normal");
    const [showRateMenu, setShowRateMenu] = useState(false); // "normal" | "edit" | "rateAgain"
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showPosterSelector, setShowPosterSelector] = useState(false);
    const [showBannerSelector, setShowBannerSelector] = useState(false);
    const [showAddToList, setShowAddToList] = useState(false);

    const [showSeriesWatchModal, setShowSeriesWatchModal] = useState(false);
    const [selectedSeasonNumbers, setSelectedSeasonNumbers] = useState([]);
    const [includeSpecials, setIncludeSpecials] = useState(false);
    const [watchHover, setWatchHover] = useState(false);

    // Initial load of status
    useEffect(() => {
        const loadStatus = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            const s = await mediaService.getMediaStatus(
                user,
                mediaId,
                mediaType,
                mediaType === "tv"
                    ? {
                        targetType: tvTargetType,
                        seasonNumber: tvSeasonNumber,
                        episodeNumber: tvEpisodeNumber,
                        seasonEpisodeCounts: seasonEpisodeCounts,
                    }
                    : {}
            );
            setStatus(prev => ({ ...prev, ...s }));
            setLoading(false);
        };
        loadStatus();
    }, [user, mediaId, mediaType, tvTargetType, tvSeasonNumber, tvEpisodeNumber, seasonEpisodeCounts]);

    // Real-time sync for watched/progress so series edits update season/episode pages instantly.
    useEffect(() => {
        if (!user || !mediaId || !mediaType) return;

        const refresh = async () => {
            const s = await mediaService.getMediaStatus(
                user,
                mediaId,
                mediaType,
                mediaType === "tv"
                    ? {
                        targetType: tvTargetType,
                        seasonNumber: tvSeasonNumber,
                        episodeNumber: tvEpisodeNumber,
                        seasonEpisodeCounts: seasonEpisodeCounts,
                    }
                    : {}
            );
            setStatus((prev) => ({ ...prev, ...s }));
        };

        const unsubscribers = [];

        if (mediaType === "tv") {
            const progressRef = doc(db, "user_series_progress", `${user.uid}_${Number(mediaId)}`);
            unsubscribers.push(onSnapshot(progressRef, () => { refresh(); }));
            const watchedSeriesRef = doc(db, "user_watched", `${user.uid}_tv_${Number(mediaId)}`);
            unsubscribers.push(onSnapshot(watchedSeriesRef, () => { refresh(); }));
        } else {
            const watchedRef = doc(db, "user_watched", `${user.uid}_${mediaType}_${Number(mediaId)}`);
            unsubscribers.push(onSnapshot(watchedRef, () => { refresh(); }));
        }

        return () => {
            unsubscribers.forEach((u) => {
                try { u(); } catch (_) {}
            });
        };
    }, [user, mediaId, mediaType, tvTargetType, tvSeasonNumber, tvEpisodeNumber, seasonEpisodeCounts]);

    const customizationId = customizationMediaId ?? mediaId;
    const customizationType = customizationMediaType ?? mediaType;
    const customizationPosterBase = customizationPosterPath ?? posterPath;
    const customizationBannerBase = customizationBannerPath ?? bannerPath ?? posterPath;

    const { customPoster, customBanner } = useMediaCustomization(
        customizationId,
        customizationType,
        customizationPosterBase,
        customizationBannerBase
    );

    const canChangePoster = !disableCustomization && allowPosterCustomization;
    const canChangeBanner = !disableCustomization && allowBannerCustomization;

    // Determine if customized
    const isPosterCustomized = customPoster && customPoster !== customizationPosterBase;
    const isBannerCustomized = !!customBanner;

    // Listen for global updates
    useEffect(() => {
        const handleUpdate = (data) => {
            if (String(data.mediaId) === String(mediaId) && data.mediaType === mediaType) {
                if (user) {
                    mediaService.getMediaStatus(
                        user,
                        mediaId,
                        mediaType,
                        mediaType === "tv"
                            ? {
                                targetType: tvTargetType,
                                seasonNumber: tvSeasonNumber,
                                episodeNumber: tvEpisodeNumber,
                                seasonEpisodeCounts: seasonEpisodeCounts,
                            }
                            : {}
                    ).then(s => setStatus(prev => ({ ...prev, ...s })));
                }
            }
        };
        eventBus.on("MEDIA_UPDATED", handleUpdate);
        return () => eventBus.off("MEDIA_UPDATED", handleUpdate);
    }, [user, mediaId, mediaType, tvTargetType, tvSeasonNumber, tvEpisodeNumber, seasonEpisodeCounts]);

    const tvSeasonEpisodeCounts = useMemo(() => {
        if (seasonEpisodeCounts && typeof seasonEpisodeCounts === "object") return seasonEpisodeCounts;
        if (!Array.isArray(seasons) || seasons.length === 0) return {};
        const out = {};
        for (const s of seasons) {
            if (s?.season_number == null) continue;
            const sn = Number(s.season_number);
            const ec = Number(s.episode_count || 0);
            if (!Number.isFinite(sn) || sn < 0) continue;
            if (!Number.isFinite(ec) || ec < 0) continue;
            out[String(sn)] = ec;
        }
        return out;
    }, [seasonEpisodeCounts, seasons]);

    useEffect(() => {
        if (!showSeriesWatchModal) return;
        let isMounted = true;

        const seedFromProgressOrDefaults = async () => {
            if (!user || mediaType !== "tv" || tvTargetType !== "series") return;

            const progress = await mediaService.getSeriesProgress(user, mediaId);
            if (!isMounted) return;

            const fromProgress = Array.isArray(progress?.watchedSeasons)
                ? progress.watchedSeasons.map((n) => Number(n)).filter((n) => Number.isFinite(n))
                : [];

            if (fromProgress.length > 0) {
                setSelectedSeasonNumbers(Array.from(new Set(fromProgress)).sort((a, b) => a - b));
                setIncludeSpecials(fromProgress.includes(0));
                return;
            }

            const list = Array.isArray(seasons)
                ? seasons.map((s) => Number(s?.season_number)).filter((n) => Number.isFinite(n))
                : [];
            setSelectedSeasonNumbers(list.filter((n) => n > 0));
            setIncludeSpecials(list.includes(0));
        };

        seedFromProgressOrDefaults();
        return () => { isMounted = false; };
    }, [showSeriesWatchModal, seasons]);

    // Keep series watch button in sync with saved progress
    useEffect(() => {
        if (!user?.uid || mediaType !== "tv" || tvTargetType !== "series" || !mediaId) return;
        const progressRef = doc(db, "user_series_progress", `${user.uid}_${Number(mediaId)}`);
        const unsub = onSnapshot(progressRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                const ws = Array.isArray(data.watchedSeasons) ? data.watchedSeasons : [];
                const we = data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? data.watchedEpisodes : {};
                const hasAny = ws.length > 0 || Object.keys(we).length > 0;
                setStatus((prev) => ({ ...prev, isWatched: Boolean(hasAny) }));
            } else {
                setStatus((prev) => ({ ...prev, isWatched: false }));
            }
        }, () => {
            setStatus((prev) => ({ ...prev, isWatched: false }));
        });
        return () => { try { unsub(); } catch (_) {} };
    }, [user?.uid, mediaType, tvTargetType, mediaId]);


    const handleWatchedToggle = async () => {
        if (!user) { showToast.info("Please sign in"); return; }

        if (mediaType === "tv") {
            if (tvTargetType === "series") {
                setShowSeriesWatchModal(true);
                return;
            }

            // Optimistic update
            const prevStatus = { ...status };
            if (status.isWatched) {
                setStatus((prev) => ({ ...prev, isWatched: false }));
                try {
                    let ok = false;
                    if (tvTargetType === "season" && tvSeasonNumber != null) {
                        ok = await mediaService.unwatchTVSeason(user, mediaId, tvSeasonNumber, tvSeasonEpisodeCounts);
                    }
                    if (tvTargetType === "episode" && tvSeasonNumber != null && tvEpisodeNumber != null) {
                        ok = await mediaService.unwatchTVEpisode(user, mediaId, tvSeasonNumber, tvEpisodeNumber, tvSeasonEpisodeCounts);
                    }
                    if (!ok) setStatus(prevStatus);
                } catch {
                    setStatus(prevStatus);
                }
                return;
            }

            // Optimistic: mark watched
            setStatus((prev) => ({ ...prev, isWatched: true, isWatchlist: false, isPaused: false, isDropped: false }));
            try {
                const seriesData = { name: title, title, poster_path: posterPath };
                let ok = false;
                if (tvTargetType === "season" && tvSeasonNumber != null) {
                    ok = await mediaService.markTVSeasonWatched(
                        user,
                        mediaId,
                        seriesData,
                        tvSeasonNumber,
                        tvSeasonEpisodeCounts,
                        {}
                    );
                }
                if (tvTargetType === "episode" && tvSeasonNumber != null && tvEpisodeNumber != null) {
                    ok = await mediaService.markTVEpisodeWatched(
                        user,
                        mediaId,
                        seriesData,
                        tvSeasonNumber,
                        tvEpisodeNumber,
                        tvSeasonEpisodeCounts,
                        {}
                    );
                }
                if (!ok) setStatus(prevStatus);
            } catch {
                setStatus(prevStatus);
            }
            return;
        }

        // Optimistic update for movies
        const prevStatus = { ...status };
        if (status.isWatched) {
            setStatus((prev) => ({ ...prev, isWatched: false }));
            try {
                const ok = await mediaService.unwatchMovie(user, mediaId);
                if (!ok) setStatus(prevStatus);
            } catch {
                setStatus(prevStatus);
            }
            return;
        }

        setStatus((prev) => ({ ...prev, isWatched: true, isWatchlist: false, isPaused: false, isDropped: false }));
        try {
            const success = await mediaService.markAsWatched(user, mediaId, mediaType, { title, poster_path: posterPath });
            if (!success) setStatus(prevStatus);
        } catch {
            setStatus(prevStatus);
        }
    };

    const toggleSeasonSelected = (seasonNum) => {
        setSelectedSeasonNumbers((prev) => {
            const set = new Set(prev);
            if (set.has(seasonNum)) set.delete(seasonNum);
            else set.add(seasonNum);
            return Array.from(set).sort((a, b) => a - b);
        });
    };

    const handleAddAllRegularSeasons = () => {
        const list = Array.isArray(seasons)
            ? seasons.map((s) => Number(s?.season_number)).filter((n) => Number.isFinite(n) && n > 0)
            : [];
        setSelectedSeasonNumbers(Array.from(new Set(list)).sort((a, b) => a - b));
    };

    const handleToggleIncludeSpecials = () => {
        const hasSpecials = Array.isArray(seasons) && seasons.some((s) => Number(s?.season_number) === 0);
        if (!hasSpecials) return;
        setIncludeSpecials((v) => !v);
        setSelectedSeasonNumbers((prev) => {
            const set = new Set(prev);
            if (!includeSpecials) set.add(0);
            else set.delete(0);
            return Array.from(set).sort((a, b) => a - b);
        });
    };

    const handleConfirmSeriesWatch = async () => {
        if (!user) return;
        const seriesData = { name: title, title, poster_path: posterPath };
        setLoading(true);
        try {
            const normalized = Array.from(new Set(selectedSeasonNumbers.map((n) => Number(n)).filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
            const toMark = includeSpecials
                ? normalized
                : normalized.filter((n) => n > 0);

            if (toMark.length === 0) {
                const okReset = await mediaService.resetTVWatchProgress(user, mediaId);
                if (okReset) setShowSeriesWatchModal(false);
                return;
            }

            const ok = await mediaService.markTVSeasonsWatchedBulk(
                user,
                mediaId,
                seriesData,
                toMark,
                tvSeasonEpisodeCounts,
                { includeSpecialsInCompletion: includeSpecials }
            );
            if (ok) setShowSeriesWatchModal(false);
        } finally {
            setLoading(false);
        }
    };

    const handleResetSeriesWatch = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const ok = await mediaService.resetTVWatchProgress(user, mediaId);
            if (ok) {
                setSelectedSeasonNumbers([]);
                setIncludeSpecials(false);
                setShowSeriesWatchModal(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleWatchingToggle = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        if (mediaType !== "tv") return;

        setLoading(true);
        try {
            if (status.isWatching) {
                const ok = await mediaService.removeFromWatching(user, mediaId);
                if (ok) setStatus(prev => ({ ...prev, isWatching: false }));
            } else {
                const ok = await mediaService.addToWatching(user, mediaId, { title, poster_path: posterPath });
                if (ok) setStatus(prev => ({ ...prev, isWatching: true }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleWatchlistToggle = async () => {
        if (!user) { showToast.info("Please sign in"); return; }

        if (status.isWatchlist) {
            showToast.info("Already in Watchlist");
            return;
        }

        // Optimistic
        const prevStatus = { ...status };
        setStatus((prev) => ({ ...prev, isWatched: false, isWatchlist: true, isPaused: false, isDropped: false }));

        const success = await mediaService.addToWatchlist(user, mediaId, mediaType, { title, poster_path: posterPath });
        if (!success) {
            setStatus(prevStatus);
        }
    };

    const handlePause = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        const success = await mediaService.pauseMedia(user, mediaId, mediaType, { title, poster_path: posterPath });
        if (success) {
            setStatus(prev => ({ ...prev, isWatched: false, isWatchlist: false, isPaused: true, isDropped: false }));
            setShowMoreMenu(false);
        }
    };

    const handleDrop = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        const success = await mediaService.dropMedia(user, mediaId, mediaType, { title, poster_path: posterPath });
        if (success) {
            setStatus(prev => ({ ...prev, isWatched: false, isWatchlist: false, isPaused: false, isDropped: true }));
            setShowMoreMenu(false);
        }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/${mediaType}/${mediaId}`;
        if (navigator.share) {
            try { await navigator.share({ title, url }); } catch (e) { /* ignore */ }
        } else {
            try { await navigator.clipboard.writeText(url); showToast.success("Link copied"); } catch (e) { showToast.error("Failed to copy"); }
        }
        setShowMoreMenu(false);
    };

    return (
        <>
            {/* Desktop Action Bar */}
            <div className="hidden md:flex items-center gap-4 py-6">
                <Button
                    variant={status.isWatched ? "glass" : "secondary"}
                    onClick={handleWatchedToggle}
                    disabled={loading}
                    className={`flex items-center gap-2 ${status.isWatched ? "btn-primary-glass" : ""}`}
                    onMouseEnter={() => setWatchHover(true)}
                    onMouseLeave={() => setWatchHover(false)}
                >
                    {status.isWatched ? <Check size={18} /> : <Eye size={18} />}
                    {status.isWatched ? (watchHover ? "Watch" : "Watched") : "Watch"}
                </Button>

                {mediaType === "tv" && (
                    <Button
                        variant={status.isWatching ? "glass" : "secondary"}
                        onClick={handleWatchingToggle}
                        disabled={loading}
                        className={`flex items-center gap-2 ${status.isWatching ? "btn-primary-glass" : ""}`}
                    >
                        <Tv size={18} />
                        {status.isWatching ? "Watching" : "Watching"}
                    </Button>
                )}

                {status.hasEntry ? (
                    <div className="relative">
                        <Button
                            variant="secondary"
                            onClick={() => setShowRateMenu(!showRateMenu)}
                            className="flex items-center gap-2"
                        >
                            <Star size={18} fill="currentColor" className="text-accent" />
                            {status.rating > 0 ? `Rated ${status.rating}` : "Reviewed"}
                        </Button>
                        {showRateMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowRateMenu(false)} />
                                <div className="absolute top-full mt-2 left-0 bg-secondary border border-white/10 rounded-lg shadow-xl z-50 min-w-[180px]">
                                    <button
                                        onClick={() => { setRatingMode("edit"); setShowRateMenu(false); setShowRatingModal(true); }}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                    >
                                        <Edit3 size={16} />
                                        Edit Review
                                    </button>
                                    <button
                                        onClick={() => { setRatingMode("rateAgain"); setShowRateMenu(false); setShowRatingModal(true); }}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm border-t border-white/5"
                                    >
                                        <RefreshCw size={16} />
                                        Watch Again
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <Button
                        variant="secondary"
                        onClick={() => { setRatingMode("normal"); setShowRatingModal(true); }}
                        className="flex items-center gap-2"
                    >
                        <Star size={18} fill="none" />
                        Rate
                    </Button>
                )}

                <Button
                    variant={status.isWatchlist ? "glass" : "secondary"}
                    onClick={handleWatchlistToggle}
                    disabled={loading || status.isWatchlist}
                    className={`flex items-center gap-2 ${status.isWatchlist ? "btn-primary-glass" : ""}`}
                >
                    <Bookmark size={18} fill={status.isWatchlist ? "currentColor" : "none"} />
                    {status.isWatchlist ? "In Watchlist" : "Watchlist"}
                </Button>

                <div className="relative">
                    <Button
                        variant={status.isPaused || status.isDropped ? "glass" : "secondary"}
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={`flex items-center gap-2 ${status.isPaused || status.isDropped ? "btn-primary-glass" : ""}`}
                    >
                        <MoreHorizontal size={18} />
                        {(status.isPaused && "Paused") || (status.isDropped && "Dropped") || "More"}
                    </Button>

                    {showMoreMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                            <div className="absolute top-full mt-2 right-0 bg-secondary border border-white/10 rounded-lg shadow-xl z-50 min-w-[200px]">
                                {mediaType === "tv" && (
                                    <button
                                        onClick={() => { handleWatchingToggle(); setShowMoreMenu(false); }}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                    >
                                        <Tv size={16} />
                                        {status.isWatching ? "Remove from Watching" : "Add to Watching"}
                                    </button>
                                )}
                                <button
                                    onClick={() => { if (!user) { showToast.info("Please sign in"); return; } setShowAddToList(true); setShowMoreMenu(false); }}
                                    className={`w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm ${mediaType === "tv" ? "border-t border-white/5" : ""}`}
                                >
                                    <ListPlus size={16} />
                                    Add to List
                                </button>
                                {canChangePoster && (
                                    <button
                                        onClick={() => { setShowPosterSelector(true); setShowMoreMenu(false); }}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm border-t border-white/5"
                                    >
                                        <ImageIcon size={16} className={isPosterCustomized ? "text-accent" : ""} />
                                        <div className="flex flex-col items-start">
                                            <span>Change Poster</span>
                                            {isPosterCustomized && <span className="text-[10px] text-accent uppercase font-bold tracking-wider">Customized</span>}
                                        </div>
                                    </button>
                                )}
                                {canChangeBanner && (
                                    <button
                                        onClick={() => { setShowBannerSelector(true); setShowMoreMenu(false); }}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm border-t border-white/5"
                                    >
                                        <ImageIcon size={16} className={isBannerCustomized ? "text-accent" : ""} />
                                        <div className="flex flex-col items-start">
                                            <span>Change Banner</span>
                                            {isBannerCustomized && <span className="text-[10px] text-accent uppercase font-bold tracking-wider">Customized</span>}
                                        </div>
                                    </button>
                                )}
                                <button
                                    onClick={handlePause}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm border-t border-white/5"
                                >
                                    <Pause size={16} />
                                    {status.isPaused ? "Paused" : "Pause"}
                                </button>
                                <button
                                    onClick={handleDrop}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm border-t border-white/5"
                                >
                                    <X size={16} />
                                    {status.isDropped ? "Dropped" : "Drop"}
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm border-t border-white/5"
                                >
                                    <Share2 size={16} />
                                    Share
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile Fixed Bottom Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-secondary border-t border-white/10 px-4 py-3 z-40">
                <div className="site-container flex items-center justify-around">
                    <button
                        onClick={handleWatchedToggle}
                        disabled={loading}
                        className={`flex flex-col items-center gap-1 text-xs font-semibold transition-all ${
                            status.isWatched ? "text-accent" : "text-textSecondary"
                        }`}
                    >
                        <div className={`p-2 rounded-full transition-all ${status.isWatched ? "btn-primary-glass" : "bg-transparent"}`}>
                            {status.isWatched ? <Check size={20} /> : <Eye size={20} />}
                        </div>
                        <span className="text-xs">{status.isWatched ? "Watched" : "Watch"}</span>
                    </button>

                    <button
                        onClick={() => { setRatingMode(status.hasEntry ? "edit" : "normal"); setShowRatingModal(true); }}
                        className={`flex flex-col items-center gap-1 ${status.hasEntry ? "text-accent" : "text-textSecondary"}`}
                    >
                        <Star size={20} fill={status.hasEntry ? "currentColor" : "none"} />
                        <span className="text-xs">{status.rating > 0 ? status.rating : status.hasEntry ? "Edit" : "Rate"}</span>
                    </button>

                    <button
                        onClick={handleWatchlistToggle}
                        disabled={loading || status.isWatchlist}
                        className={`flex flex-col items-center gap-1 ${status.isWatchlist ? "text-white" : "text-textSecondary"}`}
                    >
                        <div className={`p-2 rounded-full transition-all ${status.isWatchlist ? "btn-primary-glass" : "bg-transparent"}`}>
                            <Bookmark size={20} fill={status.isWatchlist ? "currentColor" : "none"} />
                        </div>
                        <span className="text-xs">Watchlist</span>
                    </button>

                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={`flex flex-col items-center gap-1 ${status.isPaused || status.isDropped ? "text-white" : "text-textSecondary"}`}
                    >
                        <div className={`p-2 rounded-full transition-all ${status.isPaused || status.isDropped ? "btn-primary-glass" : "bg-transparent"}`}>
                            <MoreHorizontal size={20} />
                        </div>
                        <span className="text-xs">{(status.isPaused && "Paused") || (status.isDropped && "Dropped") || "More"}</span>
                    </button>
                </div>

                {showMoreMenu && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowMoreMenu(false)} />
                        <div className="fixed bottom-20 left-4 right-4 bg-secondary border border-white/10 rounded-lg shadow-xl z-50">
                            {status.hasEntry && (
                                <button
                                    onClick={() => { setRatingMode("rateAgain"); setShowMoreMenu(false); setShowRatingModal(true); }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3"
                                >
                                    <RefreshCw size={18} />
                                    Watch Again
                                </button>
                            )}
                            <button
                                onClick={() => { if (!user) { showToast.info("Please sign in"); return; } setShowAddToList(true); setShowMoreMenu(false); }}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <ListPlus size={18} />
                                Add to List
                            </button>
                            {canChangePoster && (
                                <button
                                    onClick={() => { setShowPosterSelector(true); setShowMoreMenu(false); }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                                >
                                    <ImageIcon size={18} className={isPosterCustomized ? "text-accent" : ""} />
                                    <div className="flex flex-col items-start">
                                        <span>Change Poster</span>
                                        {isPosterCustomized && <span className="text-[10px] text-accent uppercase font-bold tracking-wider">Customized</span>}
                                    </div>
                                </button>
                            )}
                            {canChangeBanner && (
                                <button
                                    onClick={() => { setShowBannerSelector(true); setShowMoreMenu(false); }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                                >
                                    <ImageIcon size={18} className={isBannerCustomized ? "text-accent" : ""} />
                                    <div className="flex flex-col items-start">
                                        <span>Change Banner</span>
                                        {isBannerCustomized && <span className="text-[10px] text-accent uppercase font-bold tracking-wider">Customized</span>}
                                    </div>
                                </button>
                            )}
                            <button
                                onClick={handlePause}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <Pause size={18} />
                                {status.isPaused ? "Paused" : "Pause"}
                            </button>
                            <button
                                onClick={handleDrop}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <X size={18} />
                                {status.isDropped ? "Dropped" : "Drop"}
                            </button>
                            <button
                                onClick={handleShare}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <Share2 size={18} />
                                Share
                            </button>
                        </div>
                    </>
                )}
            </div>

            {showSeriesWatchModal && (
                <Modal
                    isOpen={showSeriesWatchModal}
                    onClose={() => setShowSeriesWatchModal(false)}
                    title="Mark Seasons as Watched"
                    maxWidth="720px"
                >
                    <div className="p-6 space-y-6">
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleAddAllRegularSeasons}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                            >
                                Add All Regular Seasons
                            </button>
                            <button
                                onClick={handleToggleIncludeSpecials}
                                className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${
                                    includeSpecials
                                        ? "bg-accent/20 text-white border-accent/40"
                                        : "bg-white/5 text-textSecondary border-white/10 hover:text-white"
                                }`}
                            >
                                Include Specials
                            </button>
                        </div>

                        <div className="space-y-2">
                            {Array.isArray(seasons)
                                ? seasons
                                    .map((s) => ({
                                        seasonNumber: Number(s?.season_number),
                                        name: s?.name,
                                    }))
                                    .filter((s) => Number.isFinite(s.seasonNumber))
                                    .sort((a, b) => {
                                        const an = Number(a?.seasonNumber ?? 0);
                                        const bn = Number(b?.seasonNumber ?? 0);
                                        const aIsSpecial = an === 0;
                                        const bIsSpecial = bn === 0;
                                        if (aIsSpecial && !bIsSpecial) return 1;
                                        if (!aIsSpecial && bIsSpecial) return -1;
                                        return an - bn;
                                    })
                                    .map((s) => {
                                        const checked = selectedSeasonNumbers.includes(s.seasonNumber);
                                        const label = s.seasonNumber === 0
                                            ? "Specials"
                                            : (s.name || `Season ${s.seasonNumber}`);
                                        return (
                                            <label
                                                key={s.seasonNumber}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleSeasonSelected(s.seasonNumber)}
                                                    className="h-4 w-4"
                                                />
                                                <span className="text-sm font-semibold text-white">{label}</span>
                                            </label>
                                        );
                                    })
                                : null}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowSeriesWatchModal(false)}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResetSeriesWatch}
                                disabled={loading}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition font-medium disabled:opacity-50"
                            >
                                Reset
                            </button>
                            <button
                                onClick={handleConfirmSeriesWatch}
                                disabled={loading || selectedSeasonNumbers.length === 0}
                                className="px-6 py-2 bg-accent hover:bg-accent/90 rounded-lg transition font-medium disabled:opacity-50"
                            >
                                Mark Watched
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showRatingModal && (
                <RatingModal
                    isOpen={showRatingModal}
                    onClose={() => { setShowRatingModal(false); setRatingMode("normal"); }}
                    mediaId={mediaId}
                    mediaType={mediaType}
                    title={title}
                    poster_path={posterPath}
                    currentRating={status.rating}
                    releaseYear={releaseYear}
                    mode={ratingMode}
                    seasons={seasons}
                    seriesId={mediaType === "tv" ? mediaId : null}
                    initialSeasonNumber={initialSeasonNumber}
                    initialEpisodeNumber={initialEpisodeNumber}
                />
            )}

            {canChangePoster && (
                <PosterSelector
                    isOpen={showPosterSelector}
                    onClose={() => setShowPosterSelector(false)}
                    mediaId={customizationId}
                    mediaType={customizationType}
                    defaultPoster={customizationPosterBase}
                    tmdbEndpoint={posterTmdbEndpoint}
                />
            )}

            {canChangeBanner && (
                <BannerSelector
                    isOpen={showBannerSelector}
                    onClose={() => setShowBannerSelector(false)}
                    mediaId={customizationId}
                    mediaType={customizationType}
                    defaultBanner={customizationBannerBase}
                    tmdbEndpoint={bannerTmdbEndpoint}
                />
            )}

            {showAddToList && (
                <AddToListModal
                    isOpen={showAddToList}
                    onClose={() => setShowAddToList(false)}
                    userId={user?.uid}
                    mediaId={mediaId}
                    mediaType={mediaType}
                    title={title}
                    posterPath={posterPath}
                />
            )}
        </>
    );
}
