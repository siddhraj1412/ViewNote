import supabase from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import showToast from "@/lib/toast";

/**
 * Centralized customization service
 * Handles poster/banner updates with optimistic UI, retry logic, and state sync.
 * All customizations are per-user (keyed by userId_mediaType_mediaId).
 */

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 2,
    initialDelay: 800,
    maxDelay: 4000,
    backoffMultiplier: 2,
};

// Track in-flight saves to prevent duplicates
const savesInProgress = new Set();

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
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelay);
            }
        }
    }

    throw lastError;
}

/**
 * Format error for logging — never log empty {}
 */
function formatError(error) {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    if (error.message) return `${error.message}${error.code ? ` (code: ${error.code})` : ""}`;
    if (error.code) return `Error code: ${error.code}`;
    try {
        const str = JSON.stringify(error);
        return str === "{}" ? "Empty error object from Supabase" : str;
    } catch {
        return String(error);
    }
}

export const customizationService = {
    /**
     * Update poster with optimistic UI, duplicate-save guard, and retry logic
     */
    async updatePoster(userId, mediaId, mediaType, posterPath) {
        const saveKey = `poster_${userId}_${mediaType}_${mediaId}`;
        if (savesInProgress.has(saveKey)) {
            return { success: false, error: "Save already in progress" };
        }

        const key = `${mediaType}_${mediaId}`;
        const store = useStore.getState();
        const previousCustomization = store.getCustomization(mediaId, mediaType);

        // Optimistic update
        store.setCustomization(mediaId, mediaType, {
            ...(previousCustomization || {}),
            customPoster: posterPath,
        });
        store.startOptimisticUpdate(key, { customPoster: posterPath });
        savesInProgress.add(saveKey);

        try {
            const prefId = `${userId}_${mediaType}_${mediaId}`;

            await retryWithBackoff(async () => {
                const { error } = await supabase
                    .from("user_media_preferences")
                    .upsert({
                        id: prefId,
                        userId,
                        mediaId: Number(mediaId),
                        mediaType,
                        customPoster: posterPath,
                        updatedAt: new Date().toISOString(),
                    }, { onConflict: "id" });

                if (error) throw error;
            });

            store.completeOptimisticUpdate(key);
            showToast.success("Poster changed successfully");
            return { success: true };
        } catch (error) {
            console.error("Error updating poster:", formatError(error));

            // Rollback
            store.rollbackOptimisticUpdate(key);
            if (previousCustomization) {
                store.setCustomization(mediaId, mediaType, previousCustomization);
            } else {
                store.clearCustomization(mediaId, mediaType);
            }

            showToast.error(`Failed to save poster: ${error?.message || "Please try again."}`);
            return { success: false, error: formatError(error) };
        } finally {
            savesInProgress.delete(saveKey);
        }
    },

    /**
     * Update banner with optimistic UI, duplicate-save guard, and retry logic
     */
    async updateBanner(userId, mediaId, mediaType, bannerPath) {
        const saveKey = `banner_${userId}_${mediaType}_${mediaId}`;
        if (savesInProgress.has(saveKey)) {
            return { success: false, error: "Save already in progress" };
        }

        const key = `${mediaType}_${mediaId}_banner`;
        const store = useStore.getState();
        const previousCustomization = store.getCustomization(mediaId, mediaType);

        // Optimistic update
        store.setCustomization(mediaId, mediaType, {
            ...(previousCustomization || {}),
            customBanner: bannerPath,
        });
        store.startOptimisticUpdate(key, { customBanner: bannerPath });
        savesInProgress.add(saveKey);

        try {
            const prefId = `${userId}_${mediaType}_${mediaId}`;

            await retryWithBackoff(async () => {
                const { error } = await supabase
                    .from("user_media_preferences")
                    .upsert({
                        id: prefId,
                        userId,
                        mediaId: Number(mediaId),
                        mediaType,
                        customBanner: bannerPath,
                        updatedAt: new Date().toISOString(),
                    }, { onConflict: "id" });

                if (error) throw error;
            });

            store.completeOptimisticUpdate(key);
            showToast.success("Banner changed successfully");
            return { success: true };
        } catch (error) {
            console.error("Error updating banner:", formatError(error));

            // Rollback
            store.rollbackOptimisticUpdate(key);
            if (previousCustomization) {
                store.setCustomization(mediaId, mediaType, previousCustomization);
            } else {
                store.clearCustomization(mediaId, mediaType);
            }

            showToast.error(`Failed to save banner: ${error?.message || "Please try again."}`);
            return { success: false, error: formatError(error) };
        } finally {
            savesInProgress.delete(saveKey);
        }
    },

    /**
     * Get customization from Supabase with retry
     */
    async getCustomization(userId, mediaId, mediaType) {
        try {
            const prefId = `${userId}_${mediaType}_${mediaId}`;

            const result = await retryWithBackoff(async () => {
                const { data, error } = await supabase
                    .from("user_media_preferences")
                    .select("*")
                    .eq("id", prefId)
                    .maybeSingle();

                if (error) throw error;
                return data;
            });

            return result || null;
        } catch (error) {
            console.error("Error fetching customization:", formatError(error));
            return null;
        }
    },

    /**
     * Reset customization (poster or banner) — DELETE-FIRST strategy.
     *
     * 1. Fetch the existing row
     * 2. If both fields would be null after reset → DELETE the entire row
     * 3. If only one field is being reset → UPDATE to set that field null
     * 4. If no row exists → succeed silently (already default)
     */
    async resetCustomization(userId, mediaId, mediaType, field) {
        const saveKey = `reset_${userId}_${mediaType}_${mediaId}_${field}`;
        if (savesInProgress.has(saveKey)) {
            return { success: false, error: "Reset already in progress" };
        }

        const key = `${mediaType}_${mediaId}_${field}`;
        const store = useStore.getState();
        const previousCustomization = store.getCustomization(mediaId, mediaType);

        // Optimistic update — clear the field immediately
        store.setCustomization(mediaId, mediaType, {
            ...(previousCustomization || {}),
            [field]: null,
        });
        store.startOptimisticUpdate(key, { [field]: null });
        savesInProgress.add(saveKey);

        try {
            const prefId = `${userId}_${mediaType}_${mediaId}`;

            await retryWithBackoff(async () => {
                // Step 1: Check if row exists (maybeSingle returns null without error for 0 rows)
                const { data: existing, error: fetchError } = await supabase
                    .from("user_media_preferences")
                    .select("customPoster, customBanner")
                    .eq("id", prefId)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                if (!existing) {
                    // Row doesn't exist — already at default, nothing to do
                    return;
                }

                // Step 2: Determine what remains after reset
                const otherField = field === "customPoster" ? "customBanner" : "customPoster";
                const otherValue = existing[otherField] || null;

                if (!otherValue) {
                    // Both fields are/will be null — delete the entire row
                    const { error: deleteError } = await supabase
                        .from("user_media_preferences")
                        .delete()
                        .eq("id", prefId);

                    if (deleteError) throw deleteError;
                } else {
                    // Other field still has a value — just null out this field
                    const { error: updateError } = await supabase
                        .from("user_media_preferences")
                        .update({
                            [field]: null,
                            updatedAt: new Date().toISOString(),
                        })
                        .eq("id", prefId);

                    if (updateError) throw updateError;
                }
            });

            store.completeOptimisticUpdate(key);

            // If both fields are now null, clear the store entry entirely
            const remaining = store.getCustomization(mediaId, mediaType);
            if (remaining && !remaining.customPoster && !remaining.customBanner) {
                store.clearCustomization(mediaId, mediaType);
            }

            showToast.success(`Reset to default ${field === "customPoster" ? "poster" : "banner"}`);
            return { success: true };
        } catch (error) {
            console.error(`Error resetting ${field}:`, formatError(error));

            // Rollback
            store.rollbackOptimisticUpdate(key);
            if (previousCustomization) {
                store.setCustomization(mediaId, mediaType, previousCustomization);
            }

            showToast.error(`Failed to reset: ${error?.message || "Please try again."}`);
            return { success: false, error: formatError(error) };
        } finally {
            savesInProgress.delete(saveKey);
        }
    },
};
