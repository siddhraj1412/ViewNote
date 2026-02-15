import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

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

        // Seed immediately (store or one-time fetch) while snapshot spins up.
        loadCustomization();

        const prefRef = doc(db, "user_media_preferences", `${ownerId}_${mediaType}_${mediaId}`);
        const unsub = onSnapshot(prefRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                setCustomPoster(data.customPoster || defaultPoster);
                setCustomBanner(data.customBanner || defaultBanner);

                if (user?.uid === ownerId) {
                    store.setCustomization(mediaId, mediaType, {
                        customPoster: data.customPoster,
                        customBanner: data.customBanner,
                    });
                }
            } else {
                setCustomPoster(defaultPoster);
                setCustomBanner(defaultBanner);
                if (user?.uid === ownerId) {
                    store.setCustomization(mediaId, mediaType, {
                        customPoster: null,
                        customBanner: null,
                    });
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Customization snapshot error:", error);
            setCustomPoster(defaultPoster);
            setCustomBanner(defaultBanner);
            setLoading(false);
        });

        return () => {
            try { unsub(); } catch (_) {}
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
            // Loading will also be ended by the snapshot; keep this as fallback.
            setLoading(false);
        }
    };

    return {
        customPoster,
        customBanner,
        loading,
    };
}
