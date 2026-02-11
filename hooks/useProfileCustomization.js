import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Hook to load and manage user-specific customizations for profile display
 * Fetches from Firestore and merges custom posters/banners with rated media
 * Subscribes to live updates via event system
 */
export function useProfileCustomization(userId) {
    const [customizations, setCustomizations] = useState({});
    const [loading, setLoading] = useState(true);
    const store = useStore();

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        loadAllCustomizations();

        // Subscribe to customization updates
        const handleCustomizationUpdate = (data) => {
            if (data.source !== "cross-tab") {
                // Refresh from store
                const storeCustomizations = useStore.getState().customizations;
                setCustomizations(storeCustomizations);
            }
        };

        const handleProfileUpdate = () => {
            // Refresh customizations when profile updates
            loadAllCustomizations();
        };

        store.events.on("CUSTOMIZATION_UPDATED", handleCustomizationUpdate);
        store.events.on("PROFILE_UPDATED", handleProfileUpdate);

        return () => {
            store.events.off("CUSTOMIZATION_UPDATED", handleCustomizationUpdate);
            store.events.off("PROFILE_UPDATED", handleProfileUpdate);
        };
    }, [userId]);

    const loadAllCustomizations = async () => {
        setLoading(true);

        try {
            // Fetch ALL user customizations from Firestore
            const q = query(
                collection(db, "user_media_preferences"),
                where("userId", "==", userId)
            );
            const snapshot = await getDocs(q);

            const customizationsMap = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                const key = `${data.mediaType}_${data.mediaId}`;
                customizationsMap[key] = {
                    customPoster: data.customPoster || null,
                    customBanner: data.customBanner || null,
                    updatedAt: data.updatedAt,
                };
            });

            setCustomizations(customizationsMap);

            // Also sync to Zustand store for consistency
            Object.entries(customizationsMap).forEach(([key, value]) => {
                const [mediaType, mediaId] = key.split("_");
                store.setCustomization(mediaId, mediaType, value);
            });
        } catch (error) {
            console.error("Error loading customizations:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Get custom poster for a specific media
     */
    const getCustomPoster = (mediaId, mediaType, defaultPoster) => {
        const key = `${mediaType}_${mediaId}`;
        return customizations[key]?.customPoster || defaultPoster;
    };

    /**
     * Get custom banner for a specific media
     */
    const getCustomBanner = (mediaId, mediaType, defaultBanner) => {
        const key = `${mediaType}_${mediaId}`;
        return customizations[key]?.customBanner || defaultBanner;
    };

    /**
     * Check if media has custom poster
     */
    const hasCustomPoster = (mediaId, mediaType) => {
        const key = `${mediaType}_${mediaId}`;
        return !!customizations[key]?.customPoster;
    };

    /**
     * Check if media has custom banner
     */
    const hasCustomBanner = (mediaId, mediaType) => {
        const key = `${mediaType}_${mediaId}`;
        return !!customizations[key]?.customBanner;
    };

    /**
     * Refresh customizations (for live updates)
     */
    const refresh = () => {
        loadAllCustomizations();
    };

    return {
        customizations,
        loading,
        getCustomPoster,
        getCustomBanner,
        hasCustomPoster,
        hasCustomBanner,
        refresh,
    };
}
