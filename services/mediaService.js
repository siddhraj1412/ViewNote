import { tmdb } from "@/lib/tmdb";
import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    collection,
    deleteDoc,
    writeBatch,
    runTransaction,
    serverTimestamp,
    query,
    where,
    getDocs,
    onSnapshot,
} from "firebase/firestore";
import eventBus from "@/lib/eventBus";
import showToast from "@/lib/toast";

const STATUS_COLLECTIONS = {
    watched: "user_watched",
    watchlist: "user_watchlist",
    paused: "user_paused",
    dropped: "user_dropped",
    rated: "user_ratings",
};

const TIMESTAMP_FIELDS = {
    watched: "addedAt",
    watchlist: "addedAt",
    paused: "pausedAt",
    dropped: "droppedAt",
    rated: "ratedAt",
};

const activeListeners = {};

function getUniqueId(userId, mediaType, mediaId) {
    return `${userId}_${mediaType}_${mediaId}`;
}

function buildDocData(user, mediaId, mediaType, mediaData, timestampField) {
    return {
        userId: user.uid,
        mediaId: Number(mediaId),
        mediaType,
        title: mediaData.title || mediaData.name || "",
        poster_path: mediaData.poster_path || "",
        [timestampField]: serverTimestamp(),
    };
}

async function transitionStatus(user, mediaId, mediaType, mediaData, targetStatus, extraData = {}) {
    if (!user) {
        showToast.info("Please sign in first");
        return false;
    }

    const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
    const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];

    console.log(`[MediaService] Transitioning ${uniqueId} -> ${targetStatus}`);

    try {
        await runTransaction(db, async (transaction) => {
            for (const status of primaryStatuses) {
                const ref = doc(db, STATUS_COLLECTIONS[status], uniqueId);
                await transaction.get(ref);
            }

            for (const status of primaryStatuses) {
                if (status !== targetStatus) {
                    transaction.delete(doc(db, STATUS_COLLECTIONS[status], uniqueId));
                }
            }

            const targetRef = doc(db, STATUS_COLLECTIONS[targetStatus], uniqueId);
            const timestampField = TIMESTAMP_FIELDS[targetStatus];
            const docData = {
                ...buildDocData(user, mediaId, mediaType, mediaData, timestampField),
                ...extraData,
            };
            transaction.set(targetRef, docData, { merge: true });
        });

        eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: targetStatus.toUpperCase(), userId: user.uid });
        eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
        return true;
    } catch (error) {
        console.error(`[MediaService] Transaction failed for ${targetStatus}:`, error);

        try {
            console.log(`[MediaService] Retrying with batch write...`);
            const batch = writeBatch(db);

            for (const status of primaryStatuses) {
                if (status !== targetStatus) {
                    batch.delete(doc(db, STATUS_COLLECTIONS[status], uniqueId));
                }
            }

            const targetRef = doc(db, STATUS_COLLECTIONS[targetStatus], uniqueId);
            const timestampField = TIMESTAMP_FIELDS[targetStatus];
            batch.set(targetRef, {
                ...buildDocData(user, mediaId, mediaType, mediaData, timestampField),
                ...extraData,
            }, { merge: true });

            await batch.commit();

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: targetStatus.toUpperCase(), userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            return true;
        } catch (retryError) {
            console.error(`[MediaService] Batch fallback also failed:`, retryError);
            showToast.error("Failed to update status. Please try again.");
            return false;
        }
    }
}

export const mediaService = {
    async getDetails(mediaId, mediaType) {
        try {
            if (mediaType === "movie") return await tmdb.getMovieDetails(mediaId);
            if (mediaType === "tv") return await tmdb.getTVDetails(mediaId);
            throw new Error("Invalid media type");
        } catch (error) {
            console.error("Error fetching details:", error);
            return null;
        }
    },

    async getImages(mediaId, mediaType) {
        try {
            if (mediaType === "movie") return await tmdb.getMovieImages(mediaId);
            if (mediaType === "tv") return await tmdb.getTVImages(mediaId);
            throw new Error("Invalid media type");
        } catch (error) {
            console.error("Error fetching images:", error);
            return { backdrops: [], posters: [] };
        }
    },

    async getBackdrops(mediaId, mediaType) {
        try {
            const images = await this.getImages(mediaId, mediaType);
            const backdrops = images?.backdrops || [];
            return backdrops
                .filter((b) => b.width >= 1280)
                .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } catch (error) {
            console.error("Error fetching backdrops:", error);
            return [];
        }
    },

    async markAsWatched(user, mediaId, mediaType, mediaData) {
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "watched");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" saved to your profile`, `/${uname}`);
        }
        return success;
    },

    async addToWatchlist(user, mediaId, mediaType, mediaData) {
        if (!user) { showToast.info("Please sign in first"); return false; }
        const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
        try {
            const existing = await getDoc(doc(db, "user_watchlist", uniqueId));
            if (existing.exists()) { showToast.info("Already in watchlist"); return false; }
        } catch (_) {}
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "watchlist");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" added to watchlist`, `/${uname}?tab=watchlist`);
        }
        return success;
    },

    async pauseMedia(user, mediaId, mediaType, mediaData) {
        if (!user) return false;
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "paused");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" paused`, `/${uname}?tab=paused`);
        }
        return success;
    },

    async dropMedia(user, mediaId, mediaType, mediaData) {
        if (!user) return false;
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "dropped");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" dropped`, `/${uname}?tab=dropped`);
        }
        return success;
    },

    async rateMedia(user, mediaId, mediaType, rating, mediaData) {
        if (!user) return false;
        const uniqueId = getUniqueId(user.uid, mediaType, mediaId);

        try {
            await runTransaction(db, async (transaction) => {
                const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];
                for (const status of primaryStatuses) {
                    await transaction.get(doc(db, STATUS_COLLECTIONS[status], uniqueId));
                }

                transaction.set(doc(db, "user_ratings", uniqueId), {
                    userId: user.uid, mediaId: Number(mediaId), mediaType, rating,
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    ratedAt: serverTimestamp(),
                }, { merge: true });

                transaction.set(doc(db, "user_watched", uniqueId), {
                    userId: user.uid, mediaId: Number(mediaId), mediaType,
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    addedAt: serverTimestamp(),
                }, { merge: true });

                transaction.delete(doc(db, "user_watchlist", uniqueId));
                transaction.delete(doc(db, "user_paused", uniqueId));
                transaction.delete(doc(db, "user_dropped", uniqueId));
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" rated — saved to your profile`, `/${user.username || user.uid}`);
            return true;
        } catch (error) {
            console.error("Error rating media:", error);
            try {
                const batch = writeBatch(db);
                batch.set(doc(db, "user_ratings", uniqueId), {
                    userId: user.uid, mediaId: Number(mediaId), mediaType, rating,
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    ratedAt: serverTimestamp(),
                }, { merge: true });
                batch.set(doc(db, "user_watched", uniqueId), {
                    userId: user.uid, mediaId: Number(mediaId), mediaType,
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    addedAt: serverTimestamp(),
                }, { merge: true });
                batch.delete(doc(db, "user_watchlist", uniqueId));
                batch.delete(doc(db, "user_paused", uniqueId));
                batch.delete(doc(db, "user_dropped", uniqueId));
                await batch.commit();
                eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATED", userId: user.uid });
                eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
                showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" rated — saved to your profile`, `/${user.username || user.uid}`);
                return true;
            } catch (retryError) {
                console.error("Batch rating fallback failed:", retryError);
                showToast.error("Failed to save rating");
                return false;
            }
        }
    },

    async removeRating(user, mediaId, mediaType) {
        if (!user) return false;
        const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
        try {
            await deleteDoc(doc(db, "user_ratings", uniqueId));
            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATING_REMOVED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Rating removed");
            return true;
        } catch (error) {
            console.error("Error removing rating:", error);
            showToast.error("Failed to remove rating");
            return false;
        }
    },

    async getMediaStatus(user, mediaId, mediaType) {
        if (!user) return {};
        const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
        try {
            const [watched, watchlist, paused, dropped, rating] = await Promise.all([
                getDoc(doc(db, "user_watched", uniqueId)),
                getDoc(doc(db, "user_watchlist", uniqueId)),
                getDoc(doc(db, "user_paused", uniqueId)),
                getDoc(doc(db, "user_dropped", uniqueId)),
                getDoc(doc(db, "user_ratings", uniqueId)),
            ]);
            return {
                isWatched: watched.exists(),
                isWatchlist: watchlist.exists(),
                isPaused: paused.exists(),
                isDropped: dropped.exists(),
                rating: rating.exists() ? rating.data().rating : 0,
            };
        } catch (error) {
            console.error("Error checking status:", error);
            return {};
        }
    },

    attachProfileListeners(userId, onUpdate) {
        if (!userId) return () => {};

        // Ref-count: reuse existing listeners for the same userId
        if (!activeListeners[userId]) {
            activeListeners[userId] = { unsubs: [], refCount: 0 };

            const collections = [
                { name: "user_watched", key: "watched" },
                { name: "user_paused", key: "paused" },
                { name: "user_dropped", key: "dropped" },
                { name: "user_watchlist", key: "watchlist" },
                { name: "user_ratings", key: "ratings" },
            ];

            for (const col of collections) {
                try {
                    const q = query(collection(db, col.name), where("userId", "==", userId));
                    const unsub = onSnapshot(q, (snapshot) => {
                        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                        eventBus.emit(`${col.key.toUpperCase()}_SNAPSHOT`, { items, userId });
                    }, (error) => {
                        console.error(`[MediaService] Snapshot error for ${col.name}:`, error);
                    });
                    activeListeners[userId].unsubs.push(unsub);
                } catch (error) {
                    console.error(`[MediaService] Failed to attach listener for ${col.name}:`, error);
                }
            }
        }

        activeListeners[userId].refCount++;

        // Wire up the onUpdate callback via eventBus
        const handlers = {};
        const keys = ["watched", "paused", "dropped", "watchlist", "ratings"];
        for (const key of keys) {
            const handler = (data) => {
                if (data.userId === userId && onUpdate) {
                    onUpdate(key, data.items);
                }
            };
            eventBus.on(`${key.toUpperCase()}_SNAPSHOT`, handler);
            handlers[key] = handler;
        }

        return () => {
            // Remove eventBus handlers
            for (const key of keys) {
                eventBus.off(`${key.toUpperCase()}_SNAPSHOT`, handlers[key]);
            }
            // Dec ref-count; tear down Firestore listeners when nobody is listening
            if (activeListeners[userId]) {
                activeListeners[userId].refCount--;
                if (activeListeners[userId].refCount <= 0) {
                    activeListeners[userId].unsubs.forEach((unsub) => unsub());
                    delete activeListeners[userId];
                }
            }
        };
    },

    detachProfileListeners(userId) {
        if (activeListeners[userId]) {
            activeListeners[userId].unsubs.forEach((unsub) => unsub());
            delete activeListeners[userId];
        }
    },

    async fetchAllUserMedia(userId) {
        if (!userId) return { watched: [], paused: [], dropped: [], watchlist: [], ratings: [] };
        try {
            const [watchedSnap, pausedSnap, droppedSnap, watchlistSnap, ratingsSnap] = await Promise.all([
                getDocs(query(collection(db, "user_watched"), where("userId", "==", userId))),
                getDocs(query(collection(db, "user_paused"), where("userId", "==", userId))),
                getDocs(query(collection(db, "user_dropped"), where("userId", "==", userId))),
                getDocs(query(collection(db, "user_watchlist"), where("userId", "==", userId))),
                getDocs(query(collection(db, "user_ratings"), where("userId", "==", userId))),
            ]);
            return {
                watched: watchedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                paused: pausedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                dropped: droppedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                watchlist: watchlistSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                ratings: ratingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            };
        } catch (error) {
            console.error("[MediaService] Error batch fetching user media:", error);
            return { watched: [], paused: [], dropped: [], watchlist: [], ratings: [] };
        }
    },

    async getUserSeenMediaIds(userId) {
        if (!userId) return new Set();
        try {
            const [watchedSnap, ratingsSnap, favMoviesSnap, favShowsSnap] = await Promise.all([
                getDocs(query(collection(db, "user_watched"), where("userId", "==", userId))),
                getDocs(query(collection(db, "user_ratings"), where("userId", "==", userId))),
                getDocs(query(collection(db, "favorites_movies"), where("userId", "==", userId))),
                getDocs(query(collection(db, "favorites_shows"), where("userId", "==", userId))),
            ]);
            const ids = new Set();
            watchedSnap.docs.forEach((d) => ids.add(Number(d.data().mediaId)));
            ratingsSnap.docs.forEach((d) => ids.add(Number(d.data().mediaId)));
            favMoviesSnap.docs.forEach((d) => ids.add(Number(d.data().mediaId)));
            favShowsSnap.docs.forEach((d) => ids.add(Number(d.data().mediaId)));
            return ids;
        } catch (error) {
            console.error("[MediaService] Error fetching seen IDs:", error);
            return new Set();
        }
    },
};
