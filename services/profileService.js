import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

/**
 * Profile Service
 * Fetches user profile data with customization joins
 * Includes retry logic for index errors
 */

async function retryQuery(queryFn, fallbackFn, label) {
    try {
        return await queryFn();
    } catch (error) {
        if (error.code === "failed-precondition") {
            console.warn(`[ProfileService] Missing index for ${label}. Using fallback query.`);
            try {
                return await fallbackFn();
            } catch (fallbackError) {
                console.error(`[ProfileService] Fallback also failed for ${label}:`, fallbackError);
                return [];
            }
        }
        console.error(`[ProfileService] Error in ${label}:`, error);
        return [];
    }
}

export const profileService = {

    async getCustomizationsMap(userId) {
        if (!userId) return {};
        try {
            const q = query(collection(db, "user_media_preferences"), where("userId", "==", userId));
            const snap = await getDocs(q);
            const map = {};
            snap.forEach(doc => {
                const data = doc.data();
                map[`${data.mediaType}_${data.mediaId}`] = {
                    customPoster: data.customPoster,
                    customBanner: data.customBanner
                };
            });
            return map;
        } catch (error) {
            console.error("Error fetching customizations:", error);
            return {};
        }
    },

    applyCustomizations(items, customizationsMap) {
        return items.map(item => {
            const key = `${item.mediaType}_${item.mediaId}`;
            const custom = customizationsMap[key];
            if (custom) {
                return {
                    ...item,
                    poster_path: custom.customPoster || item.poster_path,
                    backdrop_path: custom.customBanner || item.backdrop_path,
                    isCustomized: true
                };
            }
            return item;
        });
    },

    async getFavorites(userId) {
        if (!userId) return { movies: [], shows: [] };
        try {
            const [moviesSnap, showsSnap, customizationsMap] = await Promise.all([
                getDocs(query(collection(db, "favorites_movies"), where("userId", "==", userId))),
                getDocs(query(collection(db, "favorites_shows"), where("userId", "==", userId))),
                this.getCustomizationsMap(userId)
            ]);
            const movies = moviesSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data(), mediaType: "movie" }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const shows = showsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data(), mediaType: "tv" }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            return {
                movies: this.applyCustomizations(movies, customizationsMap),
                shows: this.applyCustomizations(shows, customizationsMap)
            };
        } catch (error) {
            console.error("Error fetching favorites:", error);
            return { movies: [], shows: [] };
        }
    },

    async getWatched(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        const items = await retryQuery(
            async () => {
                const q = query(
                    collection(db, "user_watched"),
                    where("userId", "==", userId),
                    orderBy("addedAt", "desc")
                );
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            },
            async () => {
                // Fallback: no orderBy (works without index)
                const q = query(
                    collection(db, "user_watched"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort client-side
                return docs.sort((a, b) => {
                    const aTime = a.addedAt?.seconds || 0;
                    const bTime = b.addedAt?.seconds || 0;
                    return bTime - aTime;
                });
            },
            "user_watched"
        );

        return this.applyCustomizations(items, customizationsMap);
    },

    async getWatching(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        const items = await retryQuery(
            async () => {
                const q = query(
                    collection(db, "user_watching"),
                    where("userId", "==", userId),
                    orderBy("startedAt", "desc")
                );
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            },
            async () => {
                const q = query(
                    collection(db, "user_watching"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return docs.sort((a, b) => {
                    const aTime = a.startedAt?.seconds || 0;
                    const bTime = b.startedAt?.seconds || 0;
                    return bTime - aTime;
                });
            },
            "user_watching"
        );

        // Stored as tv only, but keep mediaType consistent for rendering.
        const normalized = items.map((i) => ({ ...i, mediaType: i.mediaType || "tv", mediaId: i.seriesId ?? i.mediaId }));
        return this.applyCustomizations(normalized, customizationsMap);
    },

    async getWatchlist(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        const items = await retryQuery(
            async () => {
                const q = query(
                    collection(db, "user_watchlist"),
                    where("userId", "==", userId),
                    orderBy("addedAt", "desc")
                );
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            },
            async () => {
                const q = query(
                    collection(db, "user_watchlist"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return docs.sort((a, b) => {
                    const aTime = a.addedAt?.seconds || 0;
                    const bTime = b.addedAt?.seconds || 0;
                    return bTime - aTime;
                });
            },
            "user_watchlist"
        );

        return this.applyCustomizations(items, customizationsMap);
    },

    async getRatings(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        const items = await retryQuery(
            async () => {
                const q = query(
                    collection(db, "user_ratings"),
                    where("userId", "==", userId),
                    orderBy("createdAt", "desc")
                );
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            },
            async () => {
                const q = query(
                    collection(db, "user_ratings"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return docs.sort((a, b) => {
                    const aTime = a.createdAt?.seconds || a.ratedAt?.seconds || 0;
                    const bTime = b.createdAt?.seconds || b.ratedAt?.seconds || 0;
                    return bTime - aTime;
                });
            },
            "user_ratings"
        );

        return this.applyCustomizations(items, customizationsMap);
    },

    async getPaused(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        const items = await retryQuery(
            async () => {
                const q = query(
                    collection(db, "user_paused"),
                    where("userId", "==", userId),
                    orderBy("pausedAt", "desc")
                );
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            },
            async () => {
                const q = query(
                    collection(db, "user_paused"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return docs.sort((a, b) => {
                    const aTime = a.pausedAt?.seconds || 0;
                    const bTime = b.pausedAt?.seconds || 0;
                    return bTime - aTime;
                });
            },
            "user_paused"
        );

        return this.applyCustomizations(items, customizationsMap);
    },

    async getDropped(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        const items = await retryQuery(
            async () => {
                const q = query(
                    collection(db, "user_dropped"),
                    where("userId", "==", userId),
                    orderBy("droppedAt", "desc")
                );
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            },
            async () => {
                const q = query(
                    collection(db, "user_dropped"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return docs.sort((a, b) => {
                    const aTime = a.droppedAt?.seconds || 0;
                    const bTime = b.droppedAt?.seconds || 0;
                    return bTime - aTime;
                });
            },
            "user_dropped"
        );

        return this.applyCustomizations(items, customizationsMap);
    },
};
