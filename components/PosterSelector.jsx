"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Check } from "lucide-react";
import { tmdb } from "@/lib/tmdb";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function PosterSelector({ isOpen, onClose, mediaId, mediaType, defaultPoster }) {
    const [posters, setPosters] = useState([]);
    const [selectedPoster, setSelectedPoster] = useState(defaultPoster);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchPosters();
            fetchUserPoster();
        }
    }, [isOpen, mediaId, mediaType]);

    const fetchPosters = async () => {
        try {
            setLoading(true);
            const endpoint = mediaType === "movie"
                ? `https://api.themoviedb.org/3/movie/${mediaId}/images`
                : `https://api.themoviedb.org/3/tv/${mediaId}/images`;

            const response = await fetch(
                `${endpoint}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
            );
            const data = await response.json();
            setPosters(data.posters || []);
        } catch (error) {
            console.error("Error fetching posters:", error);
            showToast("Failed to load posters", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchUserPoster = async () => {
        if (!user) return;

        try {
            const prefRef = doc(db, "user_media_preferences", `${user.uid}_${mediaType}_${mediaId}`);
            const prefDoc = await getDoc(prefRef);

            if (prefDoc.exists() && prefDoc.data().customPoster) {
                setSelectedPoster(prefDoc.data().customPoster);
            }
        } catch (error) {
            console.error("Error fetching user poster:", error);
        }
    };

    const handleSave = async () => {
        if (!user) {
            showToast("Please sign in to customize", "warning");
            return;
        }

        setSaving(true);
        try {
            const prefRef = doc(db, "user_media_preferences", `${user.uid}_${mediaType}_${mediaId}`);

            await setDoc(prefRef, {
                userId: user.uid,
                mediaId,
                mediaType,
                customPoster: selectedPoster,
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            showToast("Poster updated successfully", "success");
            onClose();
            // Reload page to show new poster
            window.location.reload();
        } catch (error) {
            console.error("Error saving poster:", error);
            showToast("Failed to save poster", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const prefRef = doc(db, "user_media_preferences", `${user.uid}_${mediaType}_${mediaId}`);
            await setDoc(prefRef, {
                customPoster: null,
            }, { merge: true });

            setSelectedPoster(defaultPoster);
            showToast("Poster reset to default", "success");
            onClose();
            window.location.reload();
        } catch (error) {
            console.error("Error resetting poster:", error);
            showToast("Failed to reset poster", "error");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl z-50">
                <div className="bg-secondary border border-white/10 rounded-2xl shadow-2xl h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <h2 className="text-2xl font-bold">Select Poster</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-lg transition"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <p className="text-textSecondary">Loading posters...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {posters.map((poster, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedPoster(poster.file_path)}
                                        className={`relative aspect-[2/3] rounded-lg overflow-hidden group ${selectedPoster === poster.file_path
                                                ? "ring-4 ring-accent"
                                                : "hover:ring-2 hover:ring-white/30"
                                            }`}
                                    >
                                        <Image
                                            src={tmdb.getImageUrl(poster.file_path, "w500")}
                                            alt={`Poster ${index + 1}`}
                                            fill
                                            className="object-cover"
                                        />
                                        {selectedPoster === poster.file_path && (
                                            <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                                <div className="bg-accent rounded-full p-2">
                                                    <Check size={24} className="text-background" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-white/10">
                        <button
                            onClick={handleReset}
                            disabled={saving}
                            className="px-4 py-2 text-textSecondary hover:text-white transition"
                        >
                            Reset to Default
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-accent hover:bg-accent/90 rounded-lg transition font-medium disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
