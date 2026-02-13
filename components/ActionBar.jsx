"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import { mediaService } from "@/services/mediaService";
import eventBus from "@/lib/eventBus";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
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
    RefreshCw
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
    currentRating = 0,
    releaseYear = "",
}) {
    const { user } = useAuth();

    // Consolidated State
    const [status, setStatus] = useState({
        isWatched: false,
        isWatchlist: false,
        isPaused: false,
        isDropped: false,
        rating: currentRating,
    });
    const [loading, setLoading] = useState(true);

    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingMode, setRatingMode] = useState("normal");
    const [showRateMenu, setShowRateMenu] = useState(false); // "normal" | "edit" | "rateAgain"
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showPosterSelector, setShowPosterSelector] = useState(false);
    const [showBannerSelector, setShowBannerSelector] = useState(false);
    const [showAddToList, setShowAddToList] = useState(false);

    // Initial load of status
    useEffect(() => {
        const loadStatus = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            const s = await mediaService.getMediaStatus(user, mediaId, mediaType);
            setStatus(prev => ({ ...prev, ...s }));
            setLoading(false);
        };
        loadStatus();
    }, [user, mediaId, mediaType]);

    const { customPoster, customBanner } = useMediaCustomization(mediaId, mediaType, posterPath, null);

    // Determine if customized
    const isPosterCustomized = customPoster && customPoster !== posterPath;
    const isBannerCustomized = !!customBanner;

    // Listen for global updates
    useEffect(() => {
        const handleUpdate = (data) => {
            if (String(data.mediaId) === String(mediaId) && data.mediaType === mediaType) {
                if (user) {
                    mediaService.getMediaStatus(user, mediaId, mediaType).then(s => setStatus(prev => ({ ...prev, ...s })));
                }
            }
        };
        eventBus.on("MEDIA_UPDATED", handleUpdate);
        return () => eventBus.off("MEDIA_UPDATED", handleUpdate);
    }, [user, mediaId, mediaType]);


    const handleWatchedToggle = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        setLoading(true);

        if (status.isWatched) {
            showToast.info("Already watched");
            setLoading(false);
            return;
        }

        const success = await mediaService.markAsWatched(user, mediaId, mediaType, { title, poster_path: posterPath });
        if (success) {
            setStatus(prev => ({ ...prev, isWatched: true, isWatchlist: false, isPaused: false, isDropped: false }));
        }
        setLoading(false);
    };

    const handleWatchlistToggle = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        setLoading(true);

        if (status.isWatchlist) {
            showToast.info("Already in Watchlist");
            setLoading(false);
            return;
        }

        const success = await mediaService.addToWatchlist(user, mediaId, mediaType, { title, poster_path: posterPath });
        if (success) {
            setStatus(prev => ({ ...prev, isWatched: false, isWatchlist: true, isPaused: false, isDropped: false }));
        }
        setLoading(false);
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
                    disabled={loading || status.isWatched}
                    className={`flex items-center gap-2 ${status.isWatched ? "btn-primary-glass" : ""}`}
                >
                    {status.isWatched ? <Check size={18} /> : <Eye size={18} />}
                    {status.isWatched ? "Watched" : "Mark Watched"}
                </Button>

                {status.rating > 0 ? (
                    <div className="relative">
                        <Button
                            variant="secondary"
                            onClick={() => setShowRateMenu(!showRateMenu)}
                            className="flex items-center gap-2"
                        >
                            <Star size={18} fill="currentColor" className="text-accent" />
                            Rated {status.rating}
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
                    {status.isWatchlist ? "In Watchlist" : "Add to Watchlist"}
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
                                <button
                                    onClick={() => { if (!user) { showToast.info("Please sign in"); return; } setShowAddToList(true); setShowMoreMenu(false); }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                >
                                    <ListPlus size={16} />
                                    Add to List
                                </button>
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
                <div className="flex items-center justify-around max-w-md mx-auto">
                    <button
                        onClick={handleWatchedToggle}
                        disabled={loading || status.isWatched}
                        className={`flex flex-col items-center gap-1 ${status.isWatched ? "text-white" : "text-textSecondary"}`}
                    >
                        <div className={`p-2 rounded-full transition-all ${status.isWatched ? "btn-primary-glass" : "bg-transparent"}`}>
                            {status.isWatched ? <Check size={20} /> : <Eye size={20} />}
                        </div>
                        <span className="text-xs">{status.isWatched ? "Watched" : "Watch"}</span>
                    </button>

                    <button
                        onClick={() => { setRatingMode(status.rating > 0 ? "edit" : "normal"); setShowRatingModal(true); }}
                        className={`flex flex-col items-center gap-1 ${status.rating > 0 ? "text-accent" : "text-textSecondary"}`}
                    >
                        <Star size={20} fill={status.rating > 0 ? "currentColor" : "none"} />
                        <span className="text-xs">{status.rating > 0 ? status.rating : "Rate"}</span>
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
                            {status.rating > 0 && (
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
                />
            )}

            <PosterSelector
                isOpen={showPosterSelector}
                onClose={() => setShowPosterSelector(false)}
                mediaId={mediaId}
                mediaType={mediaType}
                defaultPoster={posterPath}
            />

            <BannerSelector
                isOpen={showBannerSelector}
                onClose={() => setShowBannerSelector(false)}
                mediaId={mediaId}
                mediaType={mediaType}
                defaultBanner={posterPath}
            />

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
