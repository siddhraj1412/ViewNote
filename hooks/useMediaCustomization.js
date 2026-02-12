import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import eventBus from "@/lib/eventBus";

/**
 * Hook for media detail pages to get and subscribe to live customization updates.
 * Returns custom poster/banner if available, with live updates.
 * 
 * Cross-user visibility: When profileUserId is provided, fetches THAT user's
 * customizations (so user2 sees user1's custom poster). When omitted, uses
 * the current authenticated user.
 */
export function useMediaCustomization(mediaId, mediaType, defaultPoster, defaultBanner, profileUserId) {
    const { user } = useAuth();
    const store = useStore();
    const [customPoster, setCustomPoster] = useState(defaultPoster);
    const [customBanner, setCustomBanner] = useState(defaultBanner);
    const [loading, setLoading] = useState(true);

    // The owner whose customizations we display
    const ownerId = profileUserId || user?.uid;

    useEffect(() => {
        if (!ownerId || !mediaId) {
            setCustomPoster(defaultPoster);
            setCustomBanner(defaultBanner);
            setLoading(false);
            return;
        }

        loadCustomization();

        // Subscribe to live updates using eventBus
        const handleUpdate = (data) => {
            if (!data || !eventBus) return;

            if (data.mediaId === mediaId && data.mediaType === mediaType) {
                // If it's the current user updating their own, read from store
                if (user?.uid === ownerId) {
                    const customization = store.getCustomization(mediaId, mediaType);
                    if (customization) {
                        setCustomPoster(customization.customPoster || defaultPoster);
                        setCustomBanner(customization.customBanner || defaultBanner);
                    } else {
                        setCustomPoster(defaultPoster);
                        setCustomBanner(defaultBanner);
                    }
                } else {
                    // Re-fetch from Firestore for cross-user
                    loadCustomization();
                }
            }
        };

        if (eventBus && typeof eventBus.on === "function") {
            eventBus.on("CUSTOMIZATION_UPDATED", handleUpdate);
        }

        return () => {
            if (eventBus && typeof eventBus.off === "function") {
                eventBus.off("CUSTOMIZATION_UPDATED", handleUpdate);
            }
        };
    }, [ownerId, mediaId, mediaType, defaultPoster, defaultBanner]);

    const loadCustomization = async () => {
        setLoading(true);

        try {
            // If viewing own profile, check store first
            if (user?.uid === ownerId) {
                const storeCustomization = store.getCustomization(mediaId, mediaType);
                if (storeCustomization) {
                    setCustomPoster(storeCustomization.customPoster || defaultPoster);
                    setCustomBanner(storeCustomization.customBanner || defaultBanner);
                    setLoading(false);
                    return;
                }
            }

            // Always fetch from Firestore using the OWNER's id
            const prefRef = doc(db, "user_media_preferences", `${ownerId}_${mediaType}_${mediaId}`);
            const prefSnap = await getDoc(prefRef);

            if (prefSnap.exists()) {
                const data = prefSnap.data();
                setCustomPoster(data.customPoster || defaultPoster);
                setCustomBanner(data.customBanner || defaultBanner);

                // Cache in store only if the current user is the owner
                if (user?.uid === ownerId) {
                    store.setCustomization(mediaId, mediaType, {
                        customPoster: data.customPoster,
                        customBanner: data.customBanner,
                    });
                }
            } else {
                setCustomPoster(defaultPoster);
                setCustomBanner(defaultBanner);
            }
        } catch (error) {
            console.error("Error loading customization:", error);
            setCustomPoster(defaultPoster);
            setCustomBanner(defaultBanner);
        } finally {
            setLoading(false);
        }
    };

    return {
        customPoster,
        customBanner,
        loading,
    };
}
