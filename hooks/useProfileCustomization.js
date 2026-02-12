import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import eventBus from "@/lib/eventBus";

/**
 * Hook to load and manage user-specific customizations for profile display.
 * 
 * Cross-user visibility: Fetches customizations for `profileUserId` (the profile
 * being viewed), NOT the logged-in user. This ensures user2 sees user1's
 * custom posters when visiting user1's profile.
 */
export function useProfileCustomization(profileUserId) {
    const { user } = useAuth();
    const [customizations, setCustomizations] = useState({});
    const [loading, setLoading] = useState(true);
    const store = useStore();

    // The user whose customizations we're displaying
    const ownerId = profileUserId || user?.uid;

    const loadAllCustomizations = useCallback(async () => {
        if (!ownerId) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            const q = query(
                collection(db, "user_media_preferences"),
                where("userId", "==", ownerId)
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

            // Sync to store only if viewing own profile
            if (user?.uid === ownerId) {
                Object.entries(customizationsMap).forEach(([key, value]) => {
                    const [mediaType, mediaId] = key.split("_");
                    store.setCustomization(parseInt(mediaId), mediaType, value);
                });
            }
        } catch (error) {
            console.error("Error loading customizations:", error);
        } finally {
            setLoading(false);
        }
    }, [ownerId, user?.uid]);

    useEffect(() => {
        loadAllCustomizations();

        const handleCustomizationUpdate = (data) => {
            if (!data) return;
            // Refresh if it's the profile owner updating
            if (user?.uid === ownerId && data.source !== "cross-tab") {
                const storeCustomizations = useStore.getState().customizations;
                setCustomizations(storeCustomizations);
            } else {
                // Cross-user: re-fetch from Firestore
                loadAllCustomizations();
            }
        };

        const handleProfileUpdate = () => {
            loadAllCustomizations();
        };

        if (eventBus && typeof eventBus.on === "function") {
            eventBus.on("CUSTOMIZATION_UPDATED", handleCustomizationUpdate);
            eventBus.on("PROFILE_UPDATED", handleProfileUpdate);
        }

        return () => {
            if (eventBus && typeof eventBus.off === "function") {
                eventBus.off("CUSTOMIZATION_UPDATED", handleCustomizationUpdate);
                eventBus.off("PROFILE_UPDATED", handleProfileUpdate);
            }
        };
    }, [ownerId, loadAllCustomizations]);

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
