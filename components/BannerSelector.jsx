"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { customizationService } from "@/services/customizationService";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/store/useStore";
import showToast from "@/lib/toast";
import Modal from "@/components/ui/Modal";
import { tmdb } from "@/lib/tmdb";

export default function BannerSelector({ isOpen, onClose, mediaId, mediaType, defaultBanner }) {
    const [banners, setBanners] = useState([]);
    const [selectedBanner, setSelectedBanner] = useState(defaultBanner);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { user } = useAuth();
    const { getCustomization } = useStore();

    useEffect(() => {
        if (isOpen) {
            fetchBanners();
            loadUserCustomization();
        }
    }, [isOpen, mediaId, mediaType]);

    const loadUserCustomization = async () => {
        if (!user) return;

        const customization = getCustomization(mediaId, mediaType);
        if (customization?.customBanner) {
            setSelectedBanner(customization.customBanner);
        }
    };

    const fetchBanners = async () => {
        try {
            setLoading(true);
            const endpoint = mediaType === "movie"
                ? `https://api.themoviedb.org/3/movie/${mediaId}/images`
                : `https://api.themoviedb.org/3/tv/${mediaId}/images`;

            const response = await fetch(
                `${endpoint}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
            );
            const data = await response.json();
            setBanners(data.backdrops || []);
        } catch (err) {
            console.error("Error fetching banners:", err);
            showToast.error("Failed to load banners");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) {
            showToast.error("Please sign in to customize");
            return;
        }

        setSaving(true);

        const result = await customizationService.updateBanner(
            user.uid,
            mediaId,
            mediaType,
            selectedBanner
        );

        setSaving(false);

        if (result.success) {
            onClose();
            // No refresh needed - optimistic update already applied
        }
    };

    const handleReset = async () => {
        if (!user) return;

        setSaving(true);

        const result = await customizationService.resetCustomization(
            user.uid,
            mediaId,
            mediaType,
            "customBanner"
        );

        setSaving(false);

        if (result.success) {
            setSelectedBanner(defaultBanner);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Banner" maxWidth="1200px">
            {/* Content */}
            <div className="p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-accent" size={40} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {banners.map((banner, index) => (
                            <button
                                key={index}
                                onClick={() => setSelectedBanner(banner.file_path)}
                                className={`relative aspect-video rounded-lg overflow-hidden transition-all ${selectedBanner === banner.file_path
                                        ? "ring-4 ring-accent"
                                        : "hover:ring-2 hover:ring-white/30"
                                    }`}
                            >
                                <Image
                                    src={tmdb.getImageUrl(banner.file_path, "w780")}
                                    alt={`Banner ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    loading="lazy"
                                />
                                {selectedBanner === banner.file_path && (
                                    <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                        <div className="bg-accent rounded-full p-2">
                                            <svg className="w-6 h-6 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer - Sticky */}
            <div className="flex items-center justify-between p-6 border-t border-white/10 bg-secondary/50 backdrop-blur-sm sticky bottom-0">
                <button
                    onClick={handleReset}
                    disabled={saving}
                    className="px-4 py-2 text-textSecondary hover:text-white transition disabled:opacity-50"
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
                        disabled={saving || selectedBanner === defaultBanner}
                        className="px-6 py-2 bg-accent hover:bg-accent/90 rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving && <Loader2 className="animate-spin" size={16} />}
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
