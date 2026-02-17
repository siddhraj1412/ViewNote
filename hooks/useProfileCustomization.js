import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";

/**
 * Hook to load and manage user-specific customizations for profile display.
 *
 * Cross-user visibility: Fetches customizations for `profileUserId` (the profile
 * being viewed), NOT the logged-in user.
 */
export function useProfileCustomization(profileUserId) {
    const { user } = useAuth();
    const [customizations, setCustomizations] = useState({});
    const [loading, setLoading] = useState(true);
    const store = useStore();

    const ownerId = profileUserId || user?.uid;

    const loadAllCustomizations = useCallback(async () => {
        if (!ownerId) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("user_media_preferences")
                .select("*")
                .eq("userId", ownerId);

            if (error) throw error;

            const customizationsMap = {};
            (data || []).forEach((row) => {
                const key = `${row.mediaType}_${row.mediaId}`;
                customizationsMap[key] = {
                    customPoster: row.customPoster,
                    customBanner: row.customBanner,
                    updatedAt: row.updatedAt,
                };
            });

            setCustomizations(customizationsMap);

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
            if (user?.uid === ownerId && data.source !== "cross-tab") {
                const storeCustomizations = useStore.getState().customizations;
                setCustomizations(storeCustomizations);
            } else {
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

    return { customizations, loading, getCustomPoster, getCustomBanner, hasCustomization, refresh };
}
