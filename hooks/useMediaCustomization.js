import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Hook for media detail pages to get and subscribe to live customization updates
 * Returns custom poster/banner if available, with live updates
 */
export function useMediaCustomization(mediaId, mediaType, defaultPoster, defaultBanner) {
    const { user } = useAuth();
    const store = useStore();
    const [customPoster, setCustomPoster] = useState(defaultPoster);
    const [customBanner, setCustomBanner] = useState(defaultBanner);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !mediaId) {
            setCustomPoster(defaultPoster);
            setCustomBanner(defaultBanner);
            setLoading(false);
            return;
        }

        loadCustomization();

        // Subscribe to live updates
        const handleUpdate = (data) => {
            if (data.mediaId === mediaId && data.mediaType === mediaType) {
                // Update from store
                const customization = store.getCustomization(mediaId, mediaType);
                if (customization) {
                    setCustomPoster(customization.customPoster || defaultPoster);
                    setCustomBanner(customization.customBanner || defaultBanner);
                } else {
                    setCustomPoster(defaultPoster);
                    setCustomBanner(defaultBanner);
                }
            }
        };

        store.events.on("CUSTOMIZATION_UPDATED", handleUpdate);

        return () => {
            store.events.off("CUSTOMIZATION_UPDATED", handleUpdate);
        };
    }, [user, mediaId, mediaType, defaultPoster, defaultBanner]);

    const loadCustomization = async () => {
        setLoading(true);

        try {
            // Check store first
            const storeCustomization = store.getCustomization(mediaId, mediaType);
            if (storeCustomization) {
                setCustomPoster(storeCustomization.customPoster || defaultPoster);
                setCustomBanner(storeCustomization.customBanner || defaultBanner);
                setLoading(false);
                return;
            }

            // Fetch from Firestore
            const prefRef = doc(db, "user_media_preferences", `${user.uid}_${mediaType}_${mediaId}`);
            const prefSnap = await getDoc(prefRef);

            if (prefSnap.exists()) {
                const data = prefSnap.data();
                setCustomPoster(data.customPoster || defaultPoster);
                setCustomBanner(data.customBanner || defaultBanner);

                // Update store
                store.setCustomization(mediaId, mediaType, {
                    customPoster: data.customPoster,
                    customBanner: data.customBanner,
                });
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
