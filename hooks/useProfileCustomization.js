import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import eventBus from "@/lib/eventBus";

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

        // Subscribe to customization updates using eventBus
        const handleCustomizationUpdate = (data) => {
            // Safety guard
            if (!data) return;

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

        // Safety guards before subscribing
        if (eventBus && typeof eventBus.on === "function") {
            eventBus.on("CUSTOMIZATION_UPDATED", handleCustomizationUpdate);
            eventBus.on("PROFILE_UPDATED", handleProfileUpdate);
        }

        return () => {
            // Safety guards before unsubscribing
            if (eventBus && typeof eventBus.off === "function") {
                eventBus.off("CUSTOMIZATION_UPDATED", handleCustomizationUpdate);
                eventBus.off("PROFILE_UPDATED", handleProfileUpdate);
            }
        };
    }, [userId, store]);

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
                    customPoster: data.customPoster,
                    customBanner: data.customBanner,
                    updatedAt: data.updatedAt,
                };
            });

            setCustomizations(customizationsMap);

            // Sync to store
            Object.entries(customizationsMap).forEach(([key, value]) => {
                const [mediaType, mediaId] = key.split("_");
                store.setCustomization(parseInt(mediaId), mediaType, value);
            });
        } catch (error) {
            console.error("Error loading customizations:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCustomPoster = (mediaId, mediaType, defaultPoster) => {
        const key = `${mediaType}_${mediaId}`;
        return customizations[key]?.customPoster || defaultPoster;
    };

    const getCustomBanner = (mediaId, mediaType, defaultBanner) => {
        const key = `${mediaType}_${mediaId}`;
        return customizations[key]?.customBanner || defaultBanner;
    };

    const hasCustomization = (mediaId, mediaType) => {
        const key = `${mediaType}_${mediaId}`;
        return !!customizations[key];
    };

    const refresh = () => {
        loadAllCustomizations();
    };

    return {
        customizations,
        loading,
        getCustomPoster,
        getCustomBanner,
        hasCustomization,
        refresh,
    };
}
