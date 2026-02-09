"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/StarRating";
import Button from "@/components/ui/Button";
import { useRatings } from "@/hooks/useRatings";
import { useAuth } from "@/context/AuthContext";

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
    const [error, setError] = useState("");
    const { setRating: saveRating } = useRatings();
    const { user } = useAuth();

    const handleSubmit = async () => {
        if (!user) {
            setError("You must be logged in to rate");
            return;
        }

        if (rating === 0) {
            setError("Please select a rating");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await saveRating(mediaId, mediaType, rating, title, poster_path);
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save rating");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Rate: ${title}`}>
            <div className="space-y-6">
                <div className="flex justify-center py-4">
                    <StarRating value={rating} onChange={setRating} size={32} />
                </div>

                {error && (
                    <div className="bg-warning bg-opacity-10 border border-warning text-warning px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

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
            </div>
        </Modal>
    );
}
