"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/StarRating";
import Button from "@/components/ui/Button";
import { mediaService } from "@/services/mediaService";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";

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

export default function RatingModal({
    isOpen,
    onClose,
    mediaId,
    mediaType,
    title,
    poster_path,
    currentRating = 0,
}) {
    const [rating, setRating] = useState(currentRating);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const handleSubmit = async () => {
        if (!user) {
            showToast.error("You must be logged in to rate");
            return;
        }

        if (rating === 0) {
            showToast.error("Please select a rating");
            return;
        }

        setLoading(true);
        try {
            await mediaService.rateMedia(user, mediaId, mediaType, rating, { title, poster_path });
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
    }

    const getRatingLabel = (value) => {
        if (value === 0) return "Select a rating";
        return RATING_LABELS[value] || "";
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Rate: ${title}`}>
            <div className="space-y-6">
                <div className="flex flex-col items-center py-4">
                    <StarRating
                        value={rating}
                        onChange={setRating}
                        size={40}
                        showHalfStars={true}
                    />
                    <div className="mt-4 text-center">
                        {rating > 0 && (
                            <>
                                <p className="text-4xl font-bold text-accent mb-2">
                                    {rating.toFixed(1)}
                                </p>
                                <p className="text-lg font-semibold text-textSecondary">
                                    {getRatingLabel(rating)}
                                </p>
                            </>
                        )}
                        {rating === 0 && (
                            <p className="text-lg text-textSecondary">
                                {getRatingLabel(0)}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-4">
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
                        disabled={loading || rating === 0}
                    >
                        {loading ? "Saving..." : "Save Rating"}
                    </Button>
                </div>
                {currentRating > 0 && (
                    <button onClick={handleRemove} disabled={loading} className="w-full text-center text-sm text-red-400 hover:text-red-300 transition-colors">
                        Remove Rating
                    </button>
                )}
            </div>
        </Modal>
    );
}
