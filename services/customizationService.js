import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { useStore } from "@/store/useStore";
import showToast from "@/lib/toast";

/**
 * Centralized customization service
 * Handles poster/banner updates with optimistic UI and state sync
 */

export const customizationService = {
    /**
     * Update poster with optimistic UI
     */
    async updatePoster(userId, mediaId, mediaType, posterPath) {
        const key = `${mediaType}_${mediaId}`;
        const store = useStore.getState();

        // Optimistic update
        store.setCustomization(mediaId, mediaType, { customPoster: posterPath });
        store.startOptimisticUpdate(key, { customPoster: posterPath });

        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            await setDoc(
                prefRef,
                {
                    userId,
                    mediaId,
                    mediaType,
                    customPoster: posterPath,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            store.completeOptimisticUpdate(key);
            showToast.success("Changed your poster · View Profile");

            return { success: true };
        } catch (error) {
            console.error("Error updating poster:", error);
            store.rollbackOptimisticUpdate(key);
            store.clearCustomization(mediaId, mediaType);
            showToast.error("Failed to save poster");

            return { success: false, error };
        }
    },

    /**
     * Update banner with optimistic UI
     */
    async updateBanner(userId, mediaId, mediaType, bannerPath) {
        const key = `${mediaType}_${mediaId}_banner`;
        const store = useStore.getState();

        // Optimistic update
        store.setCustomization(mediaId, mediaType, { customBanner: bannerPath });
        store.startOptimisticUpdate(key, { customBanner: bannerPath });

        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            await setDoc(
                prefRef,
                {
                    userId,
                    mediaId,
                    mediaType,
                    customBanner: bannerPath,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            store.completeOptimisticUpdate(key);
            showToast.success("Changed your banner · View Profile");

            return { success: true };
        } catch (error) {
            console.error("Error updating banner:", error);
            store.rollbackOptimisticUpdate(key);
            store.clearCustomization(mediaId, mediaType);
            showToast.error("Failed to save banner");

            return { success: false, error };
        }
    },

    /**
     * Get user customization
     */
    async getCustomization(userId, mediaId, mediaType) {
        const store = useStore.getState();

        // Check local state first
        const cached = store.getCustomization(mediaId, mediaType);
        if (cached) return cached;

        // Fetch from Firebase
        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);
            const prefDoc = await getDoc(prefRef);

            if (prefDoc.exists()) {
                const data = prefDoc.data();
                store.setCustomization(mediaId, mediaType, data);
                return data;
            }

            return null;
        } catch (error) {
            console.error("Error fetching customization:", error);
            return null;
        }
    },

    /**
     * Reset to default
     */
    async resetCustomization(userId, mediaId, mediaType, field) {
        const key = `${mediaType}_${mediaId}_${field}`;
        const store = useStore.getState();

        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            await setDoc(
                prefRef,
                {
                    [field]: null,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            store.clearCustomization(mediaId, mediaType);
            showToast.success(`${field === "customPoster" ? "Poster" : "Banner"} reset to default`);

            return { success: true };
        } catch (error) {
            console.error("Error resetting customization:", error);
            showToast.error("Failed to reset");

            return { success: false, error };
        }
    },
};
