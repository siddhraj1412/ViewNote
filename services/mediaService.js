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
import { aggregateAndWriteStats } from "@/components/RatingDistribution";

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

/**
 * Build a scope-aware doc ID for TV ratings/reviews.
 * - Series level: userId_tv_mediaId
 * - Season level:  userId_tv_mediaId_season_N
 * - Episode level: userId_tv_mediaId_sNeM
 * - Movies:        userId_movie_mediaId
 */
function getScopedId(userId, mediaType, mediaId, extra = {}) {
    const base = `${userId}_${mediaType}_${mediaId}`;
    if (mediaType !== "tv" || !extra.targetType) return base;
    if (extra.targetType === "season" && extra.seasonNumber != null) {
        return `${base}_season_${extra.seasonNumber}`;
    }
    if (extra.targetType === "episode" && extra.seasonNumber != null && extra.episodeNumber != null) {
        return `${base}_s${extra.seasonNumber}e${extra.episodeNumber}`;
    }
    return base;
}

/**
 * Build a scope-aware stats doc key.
 * - Series/movie: mediaType_mediaId
 * - Season:       tv_mediaId_season_N
 * - Episode:      tv_mediaId_sNeM
 */
function getScopedStatsId(mediaId, mediaType, extra = {}) {
    const base = `${mediaType}_${String(mediaId)}`;
    const targetType = extra.targetType || extra.tvTargetType || null;
    const seasonNumber = extra.seasonNumber ?? extra.tvSeasonNumber ?? null;
    const episodeNumber = extra.episodeNumber ?? extra.tvEpisodeNumber ?? null;
    if (mediaType !== "tv" || !targetType || targetType === "series") return base;
    if (targetType === "season" && seasonNumber != null) {
        return `${base}_season_${seasonNumber}`;
    }
    if (targetType === "episode" && seasonNumber != null && episodeNumber != null) {
        return `${base}_s${seasonNumber}e${episodeNumber}`;
    }
    return base;
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

    async rateMedia(user, mediaId, mediaType, rating, mediaData, reviewText = "", extra = {}) {
        if (!user) return false;
        // Use scope-aware doc ID so series/season/episode ratings coexist
        const scopedId = getScopedId(user.uid, mediaType, mediaId, extra);
        const seriesBaseId = getUniqueId(user.uid, mediaType, mediaId);
        const isRateAgain = extra.rateAgain === true;

        const ratingDoc = {
            userId: user.uid,
            mediaId: Number(mediaId),
            mediaType,
            rating: rating || 0,
            title: mediaData.title || mediaData.name || "",
            poster_path: mediaData.poster_path || "",
            review: reviewText || "",
            ratedAt: serverTimestamp(),
            username: user.username || "",
        };

        // Merge extra fields: watchedDate, liked, viewCount, tags
        if (extra.watchedDate) ratingDoc.watchedDate = extra.watchedDate;
        if (typeof extra.liked === "boolean") ratingDoc.liked = extra.liked;
        if (typeof extra.viewCount === "number" && extra.viewCount > 0) ratingDoc.viewCount = extra.viewCount;
        if (Array.isArray(extra.tags)) ratingDoc.tags = extra.tags;
        if (typeof extra.spoiler === "boolean") ratingDoc.spoiler = extra.spoiler;

        // Store TV target scope for season/episode-level reviews (accept both naming conventions)
        const targetType = extra.targetType || extra.tvTargetType || null;
        const seasonNumber = extra.seasonNumber ?? extra.tvSeasonNumber ?? null;
        const episodeNumber = extra.episodeNumber ?? extra.tvEpisodeNumber ?? null;
        if (targetType) ratingDoc.tvTargetType = targetType;
        if (typeof seasonNumber === "number") ratingDoc.tvSeasonNumber = seasonNumber;
        if (typeof episodeNumber === "number") ratingDoc.tvEpisodeNumber = episodeNumber;
        if (extra.seriesId) ratingDoc.seriesId = Number(extra.seriesId);

        try {
            if (isRateAgain) {
                // Rate Again: create a new doc with auto-generated ID
                ratingDoc.watchNumber = extra.viewCount || 2;
                ratingDoc.isRewatch = true;
                await runTransaction(db, async (transaction) => {
                    // ── ALL READS FIRST ──
                    const primaryRef = doc(db, "user_ratings", scopedId);
                    const primarySnap = await transaction.get(primaryRef);

                    // ── ALL WRITES AFTER ──
                    const newRatingRef = doc(collection(db, "user_ratings"));
                    transaction.set(newRatingRef, ratingDoc);
                    if (primarySnap.exists()) {
                        transaction.update(primaryRef, { viewCount: extra.viewCount || 2 });
                    }
                });
            } else {
                // Normal rate or edit: use scope-aware deterministic doc ID
                // Auto-mark as watched + clear conflicting statuses (always at series level)
                const watchedDoc = {
                    userId: user.uid,
                    mediaId: Number(mediaId),
                    mediaType,
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    addedAt: serverTimestamp(),
                };
                await runTransaction(db, async (transaction) => {
                    // ── READS ──
                    await transaction.get(doc(db, "user_ratings", scopedId));
                    await transaction.get(doc(db, "user_watched", seriesBaseId));

                    // ── WRITES ──
                    transaction.set(doc(db, "user_ratings", scopedId), ratingDoc, { merge: true });
                    transaction.set(doc(db, "user_watched", seriesBaseId), watchedDoc, { merge: true });
                    // Clear conflicting statuses
                    transaction.delete(doc(db, "user_watchlist", seriesBaseId));
                    transaction.delete(doc(db, "user_paused", seriesBaseId));
                    transaction.delete(doc(db, "user_dropped", seriesBaseId));
                });
            }

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            // Refresh aggregated stats for the histogram (scope-aware)
            const statsId = getScopedStatsId(mediaId, mediaType, extra);
            aggregateAndWriteStats(mediaId, mediaType, statsId, { targetType, seasonNumber, episodeNumber }).catch(() => {});

            // Propagate watch state for TV series/season ratings
            if (mediaType === "tv" && (!targetType || targetType === "series")) {
                // Series-level rating → mark all seasons + episodes watched
                this._propagateSeriesWatched(user, mediaId, mediaData).catch((err) => {
                    console.error("[MediaService] Series watch propagation error:", err);
                    showToast.error("Rating saved but failed to mark all episodes as watched");
                });
            } else if (mediaType === "tv" && targetType === "season" && seasonNumber != null) {
                // Season-level rating → mark all episodes in that season as watched
                this._propagateSeasonWatched(user, mediaId, mediaData, seasonNumber, extra.seasonEpisodeCounts).catch((err) => {
                    console.error("[MediaService] Season watch propagation error:", err);
                    showToast.error("Rating saved but failed to mark season episodes as watched");
                });
            }

            showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" rated — saved to your profile`, `/${user.username || user.uid}`);
            return true;
        } catch (error) {
            console.error("Error rating media:", error);
            try {
                const batch = writeBatch(db);
                if (isRateAgain) {
                    const newRatingRef = doc(collection(db, "user_ratings"));
                    batch.set(newRatingRef, ratingDoc);
                } else {
                    batch.set(doc(db, "user_ratings", scopedId), ratingDoc, { merge: true });
                    // Auto-mark as watched + clear conflicting statuses
                    batch.set(doc(db, "user_watched", seriesBaseId), {
                        userId: user.uid,
                        mediaId: Number(mediaId),
                        mediaType,
                        title: mediaData.title || mediaData.name || "",
                        poster_path: mediaData.poster_path || "",
                        addedAt: serverTimestamp(),
                    }, { merge: true });
                    batch.delete(doc(db, "user_watchlist", seriesBaseId));
                    batch.delete(doc(db, "user_paused", seriesBaseId));
                    batch.delete(doc(db, "user_dropped", seriesBaseId));
                }
                await batch.commit();
                eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATED", userId: user.uid });
                eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
                const statsIdFallback = getScopedStatsId(mediaId, mediaType, extra);
                aggregateAndWriteStats(mediaId, mediaType, statsIdFallback, { targetType, seasonNumber, episodeNumber }).catch(() => {});
                showToast.linked(`"${mediaData.title || mediaData.name || 'Item'}" rated — saved to your profile`, `/${user.username || user.uid}`);
                return true;
            } catch (retryError) {
                console.error("Batch rating fallback failed:", retryError);
                showToast.error("Failed to save rating");
                return false;
            }
        }
    },

    async removeRating(user, mediaId, mediaType, options = {}) {
        if (!user) return false;
        // Use scope-aware doc ID
        const scopedId = getScopedId(user.uid, mediaType, mediaId, options);
        const seriesBaseId = getUniqueId(user.uid, mediaType, mediaId);
        try {
            await runTransaction(db, async (transaction) => {
                const ratingRef = doc(db, "user_ratings", scopedId);
                const ratingSnap = await transaction.get(ratingRef);

                const watchedRef = doc(db, "user_watched", seriesBaseId);
                await transaction.get(watchedRef);

                if (ratingSnap.exists()) {
                    transaction.delete(ratingRef);
                }

                if (options.keepWatchedIfNotCompleted === false) {
                    transaction.delete(watchedRef);
                }
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATING_REMOVED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            const statsId = getScopedStatsId(mediaId, mediaType, options);
            aggregateAndWriteStats(mediaId, mediaType, statsId, options).catch(() => {});
            showToast.success("Rating removed");
            return true;
        } catch (error) {
            console.error("Error removing rating:", error);
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, "user_ratings", scopedId));
                if (options.keepWatchedIfNotCompleted === false) {
                    batch.delete(doc(db, "user_watched", seriesBaseId));
                }
                await batch.commit();
                eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATING_REMOVED", userId: user.uid });
                eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
                const statsIdFb = getScopedStatsId(mediaId, mediaType, options);
                aggregateAndWriteStats(mediaId, mediaType, statsIdFb, options).catch(() => {});
                showToast.success("Rating removed");
                return true;
            } catch (retryError) {
                console.error("Batch remove rating fallback failed:", retryError);
                showToast.error("Failed to remove rating");
                return false;
            }
        }
    },

    async getReview(user, mediaId, mediaType, scopeOpts = {}) {
        if (!user) return null;
        // Use scope-aware doc ID for TV ratings
        const scopedId = getScopedId(user.uid, mediaType, mediaId, scopeOpts);
        try {
            const snap = await getDoc(doc(db, "user_ratings", scopedId));
            if (snap.exists()) {
                const data = snap.data();
                return {
                    rating: data.rating || 0,
                    review: data.review || "",
                    watchedDate: data.watchedDate || "",
                    liked: data.liked || false,
                    viewCount: data.viewCount || 1,
                    tags: data.tags || [],
                    spoiler: data.spoiler || false,
                };
            }
            return null;
        } catch {
            return null;
        }
    },

    async getMediaStatus(user, mediaId, mediaType, scopeOpts = {}) {
        if (!user) return {};
        const baseId = getUniqueId(user.uid, mediaType, mediaId);
        // Rating uses scope-aware ID; watch status always at series level
        const ratingId = getScopedId(user.uid, mediaType, mediaId, scopeOpts);
        try {
            const [watched, watchlist, paused, dropped, rating] = await Promise.all([
                getDoc(doc(db, "user_watched", baseId)),
                getDoc(doc(db, "user_watchlist", baseId)),
                getDoc(doc(db, "user_paused", baseId)),
                getDoc(doc(db, "user_dropped", baseId)),
                getDoc(doc(db, "user_ratings", ratingId)),
            ]);
            return {
                isWatched: watched.exists(),
                isWatchlist: watchlist.exists(),
                isPaused: paused.exists(),
                isDropped: dropped.exists(),
                rating: rating.exists() ? rating.data().rating : 0,
                hasEntry: rating.exists(),
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
                { name: "user_watching", key: "watching" },
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
        const keys = ["watched", "paused", "dropped", "watchlist", "ratings", "watching"];
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

    // ══════════════════════════════════════════════════════════════
    // TV SERIES / SEASON / EPISODE WATCH MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    /**
     * Get the user's watch progress for a TV series.
     * Returns { watchedSeasons: number[], watchedEpisodes: { [seasonNum]: number[] } }
     */
    async getSeriesProgress(user, mediaId) {
        if (!user?.uid || !mediaId) return { watchedSeasons: [], watchedEpisodes: {} };
        const progressId = `${user.uid}_${Number(mediaId)}`;
        try {
            const snap = await getDoc(doc(db, "user_series_progress", progressId));
            if (!snap.exists()) return { watchedSeasons: [], watchedEpisodes: {} };
            const data = snap.data() || {};
            return {
                watchedSeasons: Array.isArray(data.watchedSeasons) ? data.watchedSeasons.map(Number) : [],
                watchedEpisodes: data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? data.watchedEpisodes : {},
            };
        } catch (error) {
            console.error("[MediaService] getSeriesProgress error:", error);
            return { watchedSeasons: [], watchedEpisodes: {} };
        }
    },

    /**
     * Mark multiple seasons (and all their episodes) as watched atomically.
     * Also marks the series itself as watched.
     */
    async markTVSeasonsWatchedBulk(user, mediaId, seriesData, seasonNumbers, seasonEpisodeCounts = {}, options = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;
        const seriesWatchedId = getUniqueId(user.uid, "tv", mediaId);

        try {
            await runTransaction(db, async (transaction) => {
                // READS
                const progressRef = doc(db, "user_series_progress", progressId);
                const progressSnap = await transaction.get(progressRef);
                const watchedRef = doc(db, "user_watched", seriesWatchedId);
                await transaction.get(watchedRef);
                const watchlistRef = doc(db, "user_watchlist", seriesWatchedId);
                await transaction.get(watchlistRef);
                const pausedRef = doc(db, "user_paused", seriesWatchedId);
                await transaction.get(pausedRef);
                const droppedRef = doc(db, "user_dropped", seriesWatchedId);
                await transaction.get(droppedRef);

                // Build watched episodes map
                const existing = progressSnap.exists() ? progressSnap.data() : {};
                const existingEpisodes = existing.watchedEpisodes && typeof existing.watchedEpisodes === "object" ? { ...existing.watchedEpisodes } : {};

                const allSeasons = Array.from(new Set(seasonNumbers.map(Number)));
                for (const sn of allSeasons) {
                    const epCount = Number(seasonEpisodeCounts[String(sn)] || 0);
                    if (epCount > 0) {
                        existingEpisodes[String(sn)] = Array.from({ length: epCount }, (_, i) => i + 1);
                    }
                }

                // WRITES
                transaction.set(progressRef, {
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons: allSeasons,
                    watchedEpisodes: existingEpisodes,
                    updatedAt: serverTimestamp(),
                }, { merge: true });

                // Mark series as watched
                transaction.set(watchedRef, {
                    userId: user.uid,
                    mediaId: Number(mediaId),
                    mediaType: "tv",
                    title: seriesData.title || seriesData.name || "",
                    poster_path: seriesData.poster_path || "",
                    addedAt: serverTimestamp(),
                }, { merge: true });

                // Clear other statuses
                transaction.delete(watchlistRef);
                transaction.delete(pausedRef);
                transaction.delete(droppedRef);
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "WATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            const uname = user.username || user.uid;
            showToast.linked(`Marked ${seasonNumbers.length} season(s) as watched`, `/${uname}`);
            return true;
        } catch (error) {
            console.error("[MediaService] markTVSeasonsWatchedBulk error:", error);
            showToast.error("Failed to mark seasons as watched");
            return false;
        }
    },

    /**
     * Mark a single season (and all its episodes) as watched.
     */
    async markTVSeasonWatched(user, mediaId, seriesData, seasonNumber, seasonEpisodeCounts = {}, options = {}) {
        return this.markTVSeasonsWatchedBulk(user, mediaId, seriesData, [seasonNumber], seasonEpisodeCounts, options);
    },

    /**
     * Mark a single episode as watched.
     */
    async markTVEpisodeWatched(user, mediaId, seriesData, seasonNumber, episodeNumber, seasonEpisodeCounts = {}, options = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;

        try {
            await runTransaction(db, async (transaction) => {
                const progressRef = doc(db, "user_series_progress", progressId);
                const progressSnap = await transaction.get(progressRef);

                const existing = progressSnap.exists() ? progressSnap.data() : {};
                const watchedEpisodes = existing.watchedEpisodes && typeof existing.watchedEpisodes === "object" ? { ...existing.watchedEpisodes } : {};
                const seasonKey = String(seasonNumber);
                const currentEps = Array.isArray(watchedEpisodes[seasonKey]) ? [...watchedEpisodes[seasonKey]] : [];

                if (!currentEps.includes(episodeNumber)) {
                    currentEps.push(episodeNumber);
                    currentEps.sort((a, b) => a - b);
                }
                watchedEpisodes[seasonKey] = currentEps;

                // Check if entire season is now watched
                const watchedSeasons = Array.isArray(existing.watchedSeasons) ? [...existing.watchedSeasons] : [];
                const totalEps = Number(seasonEpisodeCounts[seasonKey] || 0);
                if (totalEps > 0 && currentEps.length >= totalEps && !watchedSeasons.includes(seasonNumber)) {
                    watchedSeasons.push(seasonNumber);
                    watchedSeasons.sort((a, b) => a - b);
                }

                transaction.set(progressRef, {
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons,
                    watchedEpisodes,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "EPISODE_WATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success(`S${seasonNumber}E${episodeNumber} marked as watched`);
            return true;
        } catch (error) {
            console.error("[MediaService] markTVEpisodeWatched error:", error);
            showToast.error("Failed to mark episode as watched");
            return false;
        }
    },

    /**
     * Unwatch a single season (remove from progress).
     */
    async unwatchTVSeason(user, mediaId, seasonNumber, seasonEpisodeCounts = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;

        try {
            await runTransaction(db, async (transaction) => {
                const progressRef = doc(db, "user_series_progress", progressId);
                const progressSnap = await transaction.get(progressRef);

                if (!progressSnap.exists()) return;
                const existing = progressSnap.data() || {};
                const watchedSeasons = Array.isArray(existing.watchedSeasons) ? existing.watchedSeasons.filter((n) => Number(n) !== Number(seasonNumber)) : [];
                const watchedEpisodes = existing.watchedEpisodes && typeof existing.watchedEpisodes === "object" ? { ...existing.watchedEpisodes } : {};
                delete watchedEpisodes[String(seasonNumber)];

                transaction.set(progressRef, {
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons,
                    watchedEpisodes,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "SEASON_UNWATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success(`Season ${seasonNumber} unwatched`);
            return true;
        } catch (error) {
            console.error("[MediaService] unwatchTVSeason error:", error);
            showToast.error("Failed to unwatch season");
            return false;
        }
    },

    /**
     * Unwatch a single episode (remove from progress).
     */
    async unwatchTVEpisode(user, mediaId, seasonNumber, episodeNumber, seasonEpisodeCounts = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;

        try {
            await runTransaction(db, async (transaction) => {
                const progressRef = doc(db, "user_series_progress", progressId);
                const progressSnap = await transaction.get(progressRef);

                if (!progressSnap.exists()) return;
                const existing = progressSnap.data() || {};
                const watchedEpisodes = existing.watchedEpisodes && typeof existing.watchedEpisodes === "object" ? { ...existing.watchedEpisodes } : {};
                const seasonKey = String(seasonNumber);
                const currentEps = Array.isArray(watchedEpisodes[seasonKey]) ? watchedEpisodes[seasonKey].filter((e) => Number(e) !== Number(episodeNumber)) : [];

                if (currentEps.length > 0) {
                    watchedEpisodes[seasonKey] = currentEps;
                } else {
                    delete watchedEpisodes[seasonKey];
                }

                // Preserve parent states — do NOT remove season or series watched status
                const watchedSeasons = Array.isArray(existing.watchedSeasons) ? [...existing.watchedSeasons] : [];

                transaction.set(progressRef, {
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons,
                    watchedEpisodes,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "EPISODE_UNWATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success(`S${seasonNumber}E${episodeNumber} unwatched`);
            return true;
        } catch (error) {
            console.error("[MediaService] unwatchTVEpisode error:", error);
            showToast.error("Failed to unwatch episode");
            return false;
        }
    },

    /**
     * Unwatch a movie — removes from user_watched.
     */
    async unwatchMovie(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const uniqueId = getUniqueId(user.uid, "movie", mediaId);
        try {
            await deleteDoc(doc(db, "user_watched", uniqueId));
            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "movie", action: "UNWATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Removed from watched");
            return true;
        } catch (error) {
            console.error("[MediaService] unwatchMovie error:", error);
            showToast.error("Failed to remove from watched");
            return false;
        }
    },

    /**
     * Reset all watch progress for a TV series (clear progress doc + watched doc).
     */
    async resetTVWatchProgress(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;
        const seriesWatchedId = getUniqueId(user.uid, "tv", mediaId);

        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, "user_series_progress", progressId));
            batch.delete(doc(db, "user_watched", seriesWatchedId));
            await batch.commit();

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "PROGRESS_RESET", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Watch progress reset");
            return true;
        } catch (error) {
            console.error("[MediaService] resetTVWatchProgress error:", error);
            showToast.error("Failed to reset progress");
            return false;
        }
    },

    /**
     * Check if a TV show is in "Currently Watching" list.
     */
    async isWatching(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const watchingId = `${user.uid}_watching_${Number(mediaId)}`;
        try {
            const snap = await getDoc(doc(db, "user_watching", watchingId));
            return snap.exists();
        } catch {
            return false;
        }
    },

    /**
     * Add a TV show to "Currently Watching" list.
     */
    async addToWatching(user, mediaId, mediaData) {
        if (!user?.uid || !mediaId) return false;
        const watchingId = `${user.uid}_watching_${Number(mediaId)}`;
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, "user_watching", watchingId), {
                userId: user.uid,
                mediaId: Number(mediaId),
                mediaType: "tv",
                title: mediaData.title || mediaData.name || "",
                poster_path: mediaData.poster_path || "",
                addedAt: serverTimestamp(),
            });
            await batch.commit();

            // Clean up conflicting statuses (dropped, paused, watchlist)
            const cleanIds = [
                `${user.uid}_tv_${Number(mediaId)}`,
            ];
            const cleanBatch = writeBatch(db);
            let needsClean = false;
            for (const coll of ["user_dropped", "user_paused", "user_watchlist"]) {
                for (const cid of cleanIds) {
                    const ref = doc(db, coll, cid);
                    const snap = await getDoc(ref);
                    if (snap.exists()) { cleanBatch.delete(ref); needsClean = true; }
                }
            }
            if (needsClean) await cleanBatch.commit();

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "WATCHING", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Added to Currently Watching");
            return true;
        } catch (error) {
            console.error("[MediaService] addToWatching error:", error);
            showToast.error("Failed to add to watching");
            return false;
        }
    },

    /**
     * Remove from "Currently Watching" list.
     */
    async removeFromWatching(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const watchingId = `${user.uid}_watching_${Number(mediaId)}`;
        try {
            await deleteDoc(doc(db, "user_watching", watchingId));
            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "UNWATCHING", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Removed from Currently Watching");
            return true;
        } catch (error) {
            console.error("[MediaService] removeFromWatching error:", error);
            showToast.error("Failed to remove from watching");
            return false;
        }
    },

    /**
     * Propagate series-level watched to all seasons + episodes.
     * Fetches season details from TMDB to know episode counts.
     */
    async _propagateSeriesWatched(user, mediaId, mediaData) {
        if (!user?.uid || !mediaId) return;
        try {
            const { tmdb: tmdbApi } = await import("@/lib/tmdb");
            const tvDetails = await tmdbApi.getTVDetails(mediaId);
            if (!tvDetails?.seasons) return;

            const validSeasons = tvDetails.seasons.filter(
                (s) => s && typeof s.season_number === "number" && s.episode_count > 0
            );
            if (validSeasons.length === 0) return;

            const seasonNumbers = validSeasons.map((s) => s.season_number);
            const seasonEpisodeCounts = {};
            validSeasons.forEach((s) => {
                seasonEpisodeCounts[String(s.season_number)] = s.episode_count;
            });

            await this.markTVSeasonsWatchedBulk(
                user,
                mediaId,
                mediaData,
                seasonNumbers,
                seasonEpisodeCounts,
                { silent: true }
            );
        } catch (error) {
            console.error("[MediaService] _propagateSeriesWatched error:", error);
        }
    },

    /**
     * Propagate season-level watched to all episodes in that season.
     */
    async _propagateSeasonWatched(user, mediaId, mediaData, seasonNumber, seasonEpisodeCounts) {
        if (!user?.uid || !mediaId || seasonNumber == null) return;
        try {
            let epCounts = seasonEpisodeCounts || {};
            // If we don't have episode counts, fetch from TMDB
            if (!epCounts[String(seasonNumber)]) {
                const { tmdb: tmdbApi } = await import("@/lib/tmdb");
                const tvDetails = await tmdbApi.getTVDetails(mediaId);
                if (tvDetails?.seasons) {
                    tvDetails.seasons.forEach((s) => {
                        if (s?.season_number != null) {
                            epCounts[String(s.season_number)] = s.episode_count || 0;
                        }
                    });
                }
            }
            await this.markTVSeasonWatched(user, mediaId, mediaData, seasonNumber, epCounts, { silent: true });
        } catch (error) {
            console.error("[MediaService] _propagateSeasonWatched error:", error);
        }
    },
};
