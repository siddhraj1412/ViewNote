import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { useStore } from "@/store/useStore";
import showToast from "@/lib/toast";

/**
 * Centralized customization service
 * Handles poster/banner updates with optimistic UI, retry logic, and state sync
 */

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 5000, // 5 seconds
    backoffMultiplier: 2,
};

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff(fn, retries = RETRY_CONFIG.maxRetries) {
    let lastError;
    let delay = RETRY_CONFIG.initialDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < retries) {
                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelay);
            }
        }
    }

    throw lastError;
}

export const customizationService = {
    /**
     * Update poster with optimistic UI and retry logic
     */
    async updatePoster(userId, mediaId, mediaType, posterPath) {
        const key = `${mediaType}_${mediaId}`;
        const store = useStore.getState();

        // Save previous state for rollback
        const previousCustomization = store.getCustomization(mediaId, mediaType);

        // Optimistic update
        store.setCustomization(mediaId, mediaType, { customPoster: posterPath });
        store.startOptimisticUpdate(key, { customPoster: posterPath });

        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            // Retry with exponential backoff
            await retryWithBackoff(async () => {
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
            });

            store.completeOptimisticUpdate(key);
            showToast.success("Poster updated");

            return { success: true };
        } catch (error) {
            console.error("Error updating poster after retries:", error);

            // Rollback to previous state
            store.rollbackOptimisticUpdate(key);
            if (previousCustomization) {
                store.setCustomization(mediaId, mediaType, previousCustomization);
            } else {
                store.clearCustomization(mediaId, mediaType);
            }

            showToast.error("Failed to save poster. Please try again.");

            return { success: false, error };
        }
    },

    /**
     * Update banner with optimistic UI and retry logic
     */
    async updateBanner(userId, mediaId, mediaType, bannerPath) {
        const key = `${mediaType}_${mediaId}_banner`;
        const store = useStore.getState();

        // Save previous state for rollback
        const previousCustomization = store.getCustomization(mediaId, mediaType);

        // Optimistic update
        store.setCustomization(mediaId, mediaType, { customBanner: bannerPath });
        store.startOptimisticUpdate(key, { customBanner: bannerPath });

        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            // Retry with exponential backoff
            await retryWithBackoff(async () => {
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
            });

            store.completeOptimisticUpdate(key);
            showToast.success("Banner updated");

            return { success: true };
        } catch (error) {
            console.error("Error updating banner after retries:", error);

            // Rollback to previous state
            store.rollbackOptimisticUpdate(key);
            if (previousCustomization) {
                store.setCustomization(mediaId, mediaType, previousCustomization);
            } else {
                store.clearCustomization(mediaId, mediaType);
            }

            showToast.error("Failed to save banner. Please try again.");

            return { success: false, error };
        }
    },

    /**
     * Get customization from Firestore with retry
     */
    async getCustomization(userId, mediaId, mediaType) {
        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            const prefDoc = await retryWithBackoff(async () => {
                return await getDoc(prefRef);
            });

            if (prefDoc.exists()) {
                return prefDoc.data();
            }

            return null;
        } catch (error) {
            console.error("Error fetching customization:", error);
            return null;
        }
    },

    /**
     * Reset customization (poster or banner) with retry
     */
    async resetCustomization(userId, mediaId, mediaType, field) {
        const key = `${mediaType}_${mediaId}_${field}`;
        const store = useStore.getState();

        // Save previous state for rollback
        const previousCustomization = store.getCustomization(mediaId, mediaType);

        // Optimistic update - clear the field
        const updatedData = { ...previousCustomization };
        updatedData[field] = null;
        store.setCustomization(mediaId, mediaType, updatedData);
        store.startOptimisticUpdate(key, updatedData);

        try {
            const prefRef = doc(db, "user_media_preferences", `${userId}_${mediaType}_${mediaId}`);

            // Retry with exponential backoff
            await retryWithBackoff(async () => {
                await setDoc(
                    prefRef,
                    {
                        [field]: null,
                        updatedAt: new Date().toISOString(),
                    },
                    { merge: true }
                );
            });

            store.completeOptimisticUpdate(key);
            showToast.success(`Reset to default ${field === "customPoster" ? "poster" : "banner"}`);

            return { success: true };
        } catch (error) {
            console.error(`Error resetting ${field}:`, error);

            // Rollback to previous state
            store.rollbackOptimisticUpdate(key);
            if (previousCustomization) {
                store.setCustomization(mediaId, mediaType, previousCustomization);
            }

            showToast.error("Failed to reset. Please try again.");

            return { success: false, error };
        }
    },
};
