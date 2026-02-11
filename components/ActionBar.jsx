"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import {
    Eye,
    Star,
    Bookmark,
    List,
    MoreHorizontal,
    Pause,
    X,
    Image as ImageIcon,
    Share2
} from "lucide-react";
import Button from "@/components/ui/Button";
import RatingModal from "@/components/RatingModal";
import PosterSelector from "@/components/PosterSelector";
import BannerSelector from "@/components/BannerSelector";

export default function ActionBar({
    mediaId,
    mediaType,
    title,
    posterPath,
    isWatched: initialWatched = false,
    isSaved: initialSaved = false,
    currentRating = 0,
}) {
    const { user } = useAuth();

    const [isWatched, setIsWatched] = useState(initialWatched);
    const [isSaved, setIsSaved] = useState(initialSaved);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showPosterSelector, setShowPosterSelector] = useState(false);
    const [showBannerSelector, setShowBannerSelector] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleWatchedToggle = async () => {
        if (!user) {
            showToast.info("Please sign in to mark as watched");
            return;
        }

        setLoading(true);
        try {
            const actionRef = doc(db, "user_actions", `${user.uid}_${mediaId}`);

            if (isWatched) {
                // Remove watched status
                await deleteDoc(actionRef);
                setIsWatched(false);
                showToast.success("Removed from watched");
            } else {
                // Mark as watched
                await setDoc(actionRef, {
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    title,
                    posterPath,
                    watched: true,
                    watchedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                setIsWatched(true);
                showToast.success("Marked as watched");
            }
        } catch (error) {
            console.error("Error toggling watched:", error);
            showToast.error("Failed to update watched status");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToggle = async () => {
        if (!user) {
            showToast.info("Please sign in to save");
            return;
        }

        setLoading(true);
        try {
            const actionRef = doc(db, "user_actions", `${user.uid}_${mediaId}`);

            if (isSaved) {
                // Remove from saved
                await setDoc(actionRef, {
                    saved: false,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                setIsSaved(false);
                showToast.success("Removed from saved");
            } else {
                // Save
                await setDoc(actionRef, {
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    title,
                    posterPath,
                    saved: true,
                    savedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                setIsSaved(true);
                showToast.success("Saved successfully");
            }
        } catch (error) {
            console.error("Error toggling saved:", error);
            showToast.error("Failed to update saved status");
        } finally {
            setLoading(false);
        }
    };

    const handlePause = async () => {
        if (!user) {
            showToast.info("Please sign in");
            return;
        }

        try {
            const actionRef = doc(db, "user_actions", `${user.uid}_${mediaId}`);
            await setDoc(actionRef, {
                userId: user.uid,
                mediaId,
                mediaType,
                title,
                posterPath,
                paused: true,
                pausedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            showToast.success("Marked as paused");
            setShowMoreMenu(false);
        } catch (error) {
            console.error("Error pausing:", error);
            showToast.error("Failed to pause");
        }
    };

    const handleDrop = async () => {
        if (!user) {
            showToast("Please sign in", "warning");
            return;
        }

        try {
            const actionRef = doc(db, "user_actions", `${user.uid}_${mediaId}`);
            await setDoc(actionRef, {
                userId: user.uid,
                mediaId,
                mediaType,
                title,
                posterPath,
                dropped: true,
                droppedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            showToast.success("Marked as dropped");
            setShowMoreMenu(false);
        } catch (error) {
            console.error("Error dropping:", error);
            showToast.error("Failed to drop");
        }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/${mediaType}/${mediaId}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    url: url,
                });
                showToast.success("Shared successfully");
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Error sharing:", error);
                }
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(url);
                showToast.success("Link copied to clipboard");
            } catch (error) {
                console.error("Error copying:", error);
                showToast.error("Failed to copy link");
            }
        }
        setShowMoreMenu(false);
    };

    return (
        <>
            {/* Desktop Action Bar */}
            <div className="hidden md:flex items-center gap-4 py-6">
                <Button
                    variant={isWatched ? "primary" : "secondary"}
                    onClick={handleWatchedToggle}
                    disabled={loading}
                    className="flex items-center gap-2"
                >
                    <Eye size={18} />
                    {isWatched ? "Watched" : "Mark Watched"}
                </Button>

                <Button
                    variant="secondary"
                    onClick={() => setShowRatingModal(true)}
                    className="flex items-center gap-2"
                >
                    <Star size={18} />
                    {currentRating > 0 ? `Rated ${currentRating}` : "Rate"}
                </Button>

                <Button
                    variant={isSaved ? "primary" : "secondary"}
                    onClick={handleSaveToggle}
                    disabled={loading}
                    className="flex items-center gap-2"
                >
                    <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                    {isSaved ? "Saved" : "Save"}
                </Button>

                <Button
                    variant="secondary"
                    className="flex items-center gap-2"
                    disabled
                >
                    <List size={18} />
                    Lists
                </Button>

                <div className="relative">
                    <Button
                        variant="secondary"
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className="flex items-center gap-2"
                    >
                        <MoreHorizontal size={18} />
                        More
                    </Button>

                    {showMoreMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowMoreMenu(false)}
                            />
                            <div className="absolute top-full mt-2 right-0 bg-secondary border border-white/10 rounded-lg shadow-xl z-50 min-w-[180px]">
                                <button
                                    onClick={handlePause}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                >
                                    <Pause size={16} />
                                    Pause
                                </button>
                                <button
                                    onClick={handleDrop}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                >
                                    <X size={16} />
                                    Drop
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPosterSelector(true);
                                        setShowMoreMenu(false);
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                >
                                    <ImageIcon size={16} />
                                    Change Poster
                                </button>
                                <button
                                    onClick={() => {
                                        setShowBannerSelector(true);
                                        setShowMoreMenu(false);
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 text-sm"
                                >
                                    <ImageIcon size={16} />
                                    Change Banner
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
                        disabled={loading}
                        className={`flex flex-col items-center gap-1 ${isWatched ? "text-accent" : "text-textSecondary"
                            }`}
                    >
                        <Eye size={20} />
                        <span className="text-xs">Watched</span>
                    </button>

                    <button
                        onClick={() => setShowRatingModal(true)}
                        className="flex flex-col items-center gap-1 text-textSecondary hover:text-accent transition"
                    >
                        <Star size={20} fill={currentRating > 0 ? "currentColor" : "none"} />
                        <span className="text-xs">Rate</span>
                    </button>

                    <button
                        onClick={handleSaveToggle}
                        disabled={loading}
                        className={`flex flex-col items-center gap-1 ${isSaved ? "text-accent" : "text-textSecondary"
                            }`}
                    >
                        <Bookmark size={20} fill={isSaved ? "currentColor" : "none"} />
                        <span className="text-xs">Save</span>
                    </button>

                    <button
                        disabled
                        className="flex flex-col items-center gap-1 text-textSecondary opacity-50"
                    >
                        <List size={20} />
                        <span className="text-xs">Lists</span>
                    </button>

                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className="flex flex-col items-center gap-1 text-textSecondary hover:text-accent transition"
                    >
                        <MoreHorizontal size={20} />
                        <span className="text-xs">More</span>
                    </button>
                </div>

                {/* Mobile More Menu */}
                {showMoreMenu && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 z-40"
                            onClick={() => setShowMoreMenu(false)}
                        />
                        <div className="fixed bottom-20 left-4 right-4 bg-secondary border border-white/10 rounded-lg shadow-xl z-50">
                            <button
                                onClick={handlePause}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3"
                            >
                                <Pause size={18} />
                                Pause
                            </button>
                            <button
                                onClick={handleDrop}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <X size={18} />
                                Drop
                            </button>
                            <button
                                onClick={() => {
                                    setShowPosterSelector(true);
                                    setShowMoreMenu(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <ImageIcon size={18} />
                                Change Poster
                            </button>
                            <button
                                onClick={() => {
                                    setShowBannerSelector(true);
                                    setShowMoreMenu(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 transition flex items-center gap-3 border-t border-white/5"
                            >
                                <ImageIcon size={18} />
                                Change Banner
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

            {/* Rating Modal */}
            {showRatingModal && (
                <RatingModal
                    isOpen={showRatingModal}
                    onClose={() => setShowRatingModal(false)}
                    mediaId={mediaId}
                    mediaType={mediaType}
                    title={title}
                    poster_path={posterPath}
                    currentRating={currentRating}
                />
            )}

            {/* Poster Selector */}
            <PosterSelector
                isOpen={showPosterSelector}
                onClose={() => setShowPosterSelector(false)}
                mediaId={mediaId}
                mediaType={mediaType}
                defaultPoster={posterPath}
            />

            {/* Banner Selector */}
            <BannerSelector
                isOpen={showBannerSelector}
                onClose={() => setShowBannerSelector(false)}
                mediaId={mediaId}
                mediaType={mediaType}
                defaultBanner={posterPath}
            />
        </>
    );
}
