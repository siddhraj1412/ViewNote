import { tmdb } from "@/lib/tmdb";
import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    collection,
    deleteDoc,
    setDoc,
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

function bucketFromRating(rating) {
    if (rating == null) return null;
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = Math.round(n * 2) / 2;
    return Math.max(0.5, Math.min(5, rounded));
}

function getStatsDocId(mediaType, mediaId, extra = {}) {
    if (mediaType === "movie") return `movie_${Number(mediaId)}`;
    if (mediaType !== "tv") return `${mediaType}_${Number(mediaId)}`;

    const seriesId = Number(extra?.seriesId ?? mediaId);
    const targetType = extra?.targetType || "series";
    const seasonNumber = extra?.seasonNumber;
    const episodeNumber = extra?.episodeNumber;

    if (targetType === "episode" && seasonNumber != null && episodeNumber != null) {
        return `tv_${seriesId}_s${Number(seasonNumber)}e${Number(episodeNumber)}`;
    }
    if (targetType === "season" && seasonNumber != null) {
        return `tv_${seriesId}_season_${Number(seasonNumber)}`;
    }
    return `tv_${seriesId}`;
}

function getStatsRef(mediaType, mediaId, extra = {}) {
    if (!mediaType) return null;
    if (mediaType !== "movie" && mediaType !== "tv") return null;
    return doc(db, "media_stats", getStatsDocId(mediaType, mediaId, extra));
}

function getUniqueId(userId, mediaType, mediaId) {
    return `${userId}_${mediaType}_${mediaId}`;
}

function getRatingDocId(userId, mediaType, mediaId, extra = {}) {
    if (!userId) return null;
    const idNum = Number(mediaId);
    if (!Number.isFinite(idNum)) return null;

    if (mediaType === "movie") {
        return `${userId}_movie_${idNum}`;
    }

    if (mediaType !== "tv") {
        return `${userId}_${mediaType}_${idNum}`;
    }

    const seriesId = Number(extra?.seriesId ?? mediaId);
    const targetType = extra?.targetType || "series";
    const seasonNumber = extra?.seasonNumber;
    const episodeNumber = extra?.episodeNumber;

    if (targetType === "episode" && seasonNumber != null && episodeNumber != null) {
        return `${userId}_tv_${seriesId}_s${Number(seasonNumber)}e${Number(episodeNumber)}`;
    }
    if (targetType === "season" && seasonNumber != null) {
        return `${userId}_tv_${seriesId}_season_${Number(seasonNumber)}`;
    }
    return `${userId}_tv_${seriesId}`;
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
    const statsRef = getStatsRef(mediaType, mediaId);

    console.log(`[MediaService] Transitioning ${uniqueId} -> ${targetStatus}`);

    try {
        await runTransaction(db, async (transaction) => {
            const watchedRef = doc(db, STATUS_COLLECTIONS.watched, uniqueId);
            const watchedSnap = await transaction.get(watchedRef);
            const wasWatched = watchedSnap.exists();

            const statsSnap = statsRef ? await transaction.get(statsRef) : null;
            const statsData = statsSnap?.exists() ? (statsSnap.data() || {}) : {};

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

            // Update watcher count on watched <-> not-watched transitions.
            // Only applies to primary media stats (movie_{id} / tv_{id}).
            if (statsRef) {
                const willBeWatched = targetStatus === "watched";
                const delta = (willBeWatched && !wasWatched) ? 1 : (!willBeWatched && wasWatched) ? -1 : 0;
                if (delta !== 0) {
                    const prev = Number(statsData.totalWatchers || 0);
                    transaction.set(
                        statsRef,
                        { totalWatchers: Math.max(0, prev + delta) },
                        { merge: true }
                    );
                }
            }
        });

        eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: targetStatus.toUpperCase(), userId: user.uid });
        eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
        return true;
    } catch (error) {
        console.error(`[MediaService] Transaction failed for ${targetStatus}:`, error);

        try {
            console.log(`[MediaService] Retrying with batch write...`);
            const batch = writeBatch(db);

            // Best-effort stats update for watcher count in batch fallback.
            // (We can't reliably compute deltas without reads here.)

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

    async getSeriesProgress(user, seriesId) {
        if (!user?.uid) return { watchedSeasons: [], watchedEpisodes: {} };
        const idNum = Number(seriesId);
        if (!Number.isFinite(idNum)) return { watchedSeasons: [], watchedEpisodes: {} };

        try {
            const progressRef = doc(db, "user_series_progress", `${user.uid}_${idNum}`);
            const snap = await getDoc(progressRef);
            if (!snap.exists()) return { watchedSeasons: [], watchedEpisodes: {} };
            const data = snap.data() || {};
            return {
                watchedSeasons: Array.isArray(data.watchedSeasons) ? data.watchedSeasons : [],
                watchedEpisodes: data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? data.watchedEpisodes : {},
            };
        } catch (e) {
            console.error("[MediaService] getSeriesProgress error:", e);
            return { watchedSeasons: [], watchedEpisodes: {} };
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

    async unwatchMovie(user, movieId) {
        if (!user) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(movieId);
        if (!Number.isFinite(idNum)) return false;

        const uniqueId = getUniqueId(user.uid, "movie", idNum);
        const watchedRef = doc(db, "user_watched", uniqueId);
        const statsRef = getStatsRef("movie", idNum);

        try {
            await runTransaction(db, async (tx) => {
                const watchedSnap = await tx.get(watchedRef);
                const statsSnap = statsRef ? await tx.get(statsRef) : null;
                const statsData = statsSnap?.exists() ? (statsSnap.data() || {}) : {};

                if (watchedSnap.exists()) {
                    tx.delete(watchedRef);
                    if (statsRef) {
                        const prev = Number(statsData.totalWatchers || 0);
                        tx.set(statsRef, { totalWatchers: Math.max(0, prev - 1) }, { merge: true });
                    }
                }
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "movie", action: "UNWATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Removed from watched");
            return true;
        } catch (e) {
            console.error("Error unwatching movie:", e);
            showToast.error("Failed to update");
            return false;
        }
    },

    async resetTVWatchProgress(user, seriesId) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        if (!Number.isFinite(idNum)) return false;

        const progressRef = doc(db, "user_series_progress", `${user.uid}_${idNum}`);
        try {
            await deleteDoc(progressRef);
            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "PROGRESS_RESET", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Progress reset");
            return true;
        } catch (e) {
            console.error("[MediaService] resetTVWatchProgress error:", e);
            showToast.error("Failed to update");
            return false;
        }
    },

    async markTVSeasonsWatchedBulk(user, seriesId, seriesData, seasonNumbers = [], seasonEpisodeCounts = {}, options = {}) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        if (!Number.isFinite(idNum)) return false;

        const normalized = Array.from(new Set((Array.isArray(seasonNumbers) ? seasonNumbers : [])
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n))
        )).sort((a, b) => a - b);

        const progressRef = doc(db, "user_series_progress", `${user.uid}_${idNum}`);
        try {
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(progressRef);
                const prev = snap.exists() ? (snap.data() || {}) : {};
                const prevEpisodes = prev.watchedEpisodes && typeof prev.watchedEpisodes === "object" ? prev.watchedEpisodes : {};

                const nextEpisodes = { ...prevEpisodes };
                for (const sn of normalized) {
                    const total = Number(seasonEpisodeCounts?.[String(sn)] || 0);
                    if (Number.isFinite(total) && total > 0) {
                        nextEpisodes[String(sn)] = Array.from({ length: total }, (_, i) => i + 1);
                    }
                }

                tx.set(progressRef, {
                    userId: user.uid,
                    seriesId: idNum,
                    title: seriesData?.title || seriesData?.name || "",
                    poster_path: seriesData?.poster_path || "",
                    watchedSeasons: normalized,
                    watchedEpisodes: nextEpisodes,
                    updatedAt: serverTimestamp(),
                    includeSpecialsInCompletion: options?.includeSpecialsInCompletion === true,
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "SEASONS_WATCHED_BULK", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Progress updated");
            return true;
        } catch (e) {
            console.error("[MediaService] markTVSeasonsWatchedBulk error:", e);
            showToast.error("Failed to update");
            return false;
        }
    },

    async markTVSeasonWatched(user, seriesId, seriesData, seasonNumber, seasonEpisodeCounts = {}, options = {}) {
        const sn = Number(seasonNumber);
        if (!Number.isFinite(sn)) return false;
        return await this.markTVSeasonsWatchedBulk(user, seriesId, seriesData, [sn], seasonEpisodeCounts, options);
    },

    async markTVEpisodeWatched(user, seriesId, seriesData, seasonNumber, episodeNumber, seasonEpisodeCounts = {}, options = {}) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        const sn = Number(seasonNumber);
        const en = Number(episodeNumber);
        if (!Number.isFinite(idNum) || !Number.isFinite(sn) || !Number.isFinite(en)) return false;

        const progressRef = doc(db, "user_series_progress", `${user.uid}_${idNum}`);
        try {
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(progressRef);
                const prev = snap.exists() ? (snap.data() || {}) : {};
                const prevWatchedSeasons = Array.isArray(prev.watchedSeasons) ? prev.watchedSeasons.map(Number) : [];
                const prevEpisodes = prev.watchedEpisodes && typeof prev.watchedEpisodes === "object" ? prev.watchedEpisodes : {};

                const seasonKey = String(sn);
                const currentList = Array.isArray(prevEpisodes[seasonKey]) ? prevEpisodes[seasonKey].map(Number) : [];
                const currentSet = new Set(currentList.filter((n) => Number.isFinite(n)));
                currentSet.add(en);

                const nextEpisodes = { ...prevEpisodes, [seasonKey]: Array.from(currentSet).sort((a, b) => a - b) };

                const total = Number(seasonEpisodeCounts?.[seasonKey] || 0);
                const watchedSeasonSet = new Set(prevWatchedSeasons.filter((n) => Number.isFinite(n)));
                if (Number.isFinite(total) && total > 0 && currentSet.size >= total) {
                    watchedSeasonSet.add(sn);
                }

                tx.set(progressRef, {
                    userId: user.uid,
                    seriesId: idNum,
                    title: seriesData?.title || seriesData?.name || "",
                    poster_path: seriesData?.poster_path || "",
                    watchedSeasons: Array.from(watchedSeasonSet).sort((a, b) => a - b),
                    watchedEpisodes: nextEpisodes,
                    updatedAt: serverTimestamp(),
                    includeSpecialsInCompletion: options?.includeSpecialsInCompletion === true,
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "EPISODE_WATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Episode marked as watched");
            return true;
        } catch (e) {
            console.error("[MediaService] markTVEpisodeWatched error:", e);
            showToast.error("Failed to update");
            return false;
        }
    },

    async unwatchTVSeason(user, seriesId, seasonNumber, seasonEpisodeCounts = {}) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        const sn = Number(seasonNumber);
        if (!Number.isFinite(idNum) || !Number.isFinite(sn)) return false;

        const progressRef = doc(db, "user_series_progress", `${user.uid}_${idNum}`);
        try {
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(progressRef);
                if (!snap.exists()) return;
                const data = snap.data() || {};
                const prevWatchedSeasons = Array.isArray(data.watchedSeasons) ? data.watchedSeasons.map(Number) : [];
                const prevEpisodes = data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? data.watchedEpisodes : {};

                const nextSeasons = prevWatchedSeasons.filter((n) => Number.isFinite(n) && n !== sn);
                const nextEpisodes = { ...prevEpisodes };
                delete nextEpisodes[String(sn)];

                tx.set(progressRef, {
                    watchedSeasons: nextSeasons,
                    watchedEpisodes: nextEpisodes,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "SEASON_UNWATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Season unmarked");
            return true;
        } catch (e) {
            console.error("[MediaService] unwatchTVSeason error:", e);
            showToast.error("Failed to update");
            return false;
        }
    },

    async unwatchTVEpisode(user, seriesId, seasonNumber, episodeNumber, seasonEpisodeCounts = {}) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        const sn = Number(seasonNumber);
        const en = Number(episodeNumber);
        if (!Number.isFinite(idNum) || !Number.isFinite(sn) || !Number.isFinite(en)) return false;

        const progressRef = doc(db, "user_series_progress", `${user.uid}_${idNum}`);
        try {
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(progressRef);
                if (!snap.exists()) return;
                const data = snap.data() || {};
                const prevWatchedSeasons = Array.isArray(data.watchedSeasons) ? data.watchedSeasons.map(Number) : [];
                const prevEpisodes = data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? data.watchedEpisodes : {};

                const seasonKey = String(sn);
                const current = Array.isArray(prevEpisodes[seasonKey]) ? prevEpisodes[seasonKey].map(Number) : [];
                const nextSet = new Set(current.filter((n) => Number.isFinite(n) && n !== en));
                const nextEpisodes = { ...prevEpisodes, [seasonKey]: Array.from(nextSet).sort((a, b) => a - b) };

                const total = Number(seasonEpisodeCounts?.[seasonKey] || 0);
                const watchedSeasonSet = new Set(prevWatchedSeasons.filter((n) => Number.isFinite(n)));
                if (watchedSeasonSet.has(sn)) {
                    if (!Number.isFinite(total) || total <= 0 || nextSet.size < total) {
                        watchedSeasonSet.delete(sn);
                    }
                }

                tx.set(progressRef, {
                    watchedSeasons: Array.from(watchedSeasonSet).sort((a, b) => a - b),
                    watchedEpisodes: nextEpisodes,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "EPISODE_UNWATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Episode unmarked");
            return true;
        } catch (e) {
            console.error("[MediaService] unwatchTVEpisode error:", e);
            showToast.error("Failed to update");
            return false;
        }
    },

    async isWatching(user, seriesId) {
        if (!user?.uid) return false;
        const idNum = Number(seriesId);
        if (!Number.isFinite(idNum)) return false;
        try {
            const snap = await getDoc(doc(db, "user_watching", `${user.uid}_${idNum}`));
            return snap.exists();
        } catch {
            return false;
        }
    },

    async addToWatching(user, seriesId, data = {}) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        if (!Number.isFinite(idNum)) return false;
        try {
            await setDoc(doc(db, "user_watching", `${user.uid}_${idNum}`), {
                userId: user.uid,
                seriesId: idNum,
                title: data.title || "",
                poster_path: data.poster_path || "",
                currentSeason: data.currentSeason != null ? Number(data.currentSeason) : null,
                currentEpisode: data.currentEpisode != null ? Number(data.currentEpisode) : null,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "WATCHING_ADDED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            return true;
        } catch (e) {
            console.error("[MediaService] addToWatching error:", e);
            return false;
        }
    },

    async removeFromWatching(user, seriesId) {
        if (!user?.uid) { showToast.info("Please sign in first"); return false; }
        const idNum = Number(seriesId);
        if (!Number.isFinite(idNum)) return false;
        try {
            await deleteDoc(doc(db, "user_watching", `${user.uid}_${idNum}`));
            eventBus.emit("MEDIA_UPDATED", { mediaId: idNum, mediaType: "tv", action: "WATCHING_REMOVED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            return true;
        } catch (e) {
            console.error("[MediaService] removeFromWatching error:", e);
            return false;
        }
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
        const statusUniqueId = getUniqueId(user.uid, mediaType, mediaId);
        const ratingDocId = getRatingDocId(user.uid, mediaType, mediaId, extra);
        if (!ratingDocId) return false;
        const isRateAgain = extra.rateAgain === true;

        const statsRef = getStatsRef(mediaType, mediaId, extra);

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

        // Merge TV targeting fields (used by series aggregation + diary)
        if (mediaType === "tv") {
            if (extra.targetType) ratingDoc.targetType = extra.targetType;
            if (extra.seriesId != null) ratingDoc.seriesId = Number(extra.seriesId);
            if (extra.seasonNumber != null) ratingDoc.seasonNumber = Number(extra.seasonNumber);
            if (extra.episodeNumber != null) ratingDoc.episodeNumber = Number(extra.episodeNumber);
            if (extra.totalSeasons != null) ratingDoc.totalSeasons = Number(extra.totalSeasons);
            if (extra.seasonEpisodeCounts && typeof extra.seasonEpisodeCounts === "object") {
                ratingDoc.seasonEpisodeCounts = extra.seasonEpisodeCounts;
            }
        }

        // Merge extra fields: watchedDate, liked, viewCount, tags
        if (extra.watchedDate) ratingDoc.watchedDate = extra.watchedDate;
        if (typeof extra.liked === "boolean") ratingDoc.liked = extra.liked;
        if (typeof extra.viewCount === "number" && extra.viewCount > 0) ratingDoc.viewCount = extra.viewCount;
        if (Array.isArray(extra.tags)) ratingDoc.tags = extra.tags;

        const watchedDoc = {
            userId: user.uid,
            mediaId: Number(mediaId),
            mediaType,
            title: mediaData.title || mediaData.name || "",
            poster_path: mediaData.poster_path || "",
            addedAt: serverTimestamp(),
        };

        try {
            if (isRateAgain) {
                // Rate Again: create a new doc with auto-generated ID
                ratingDoc.watchNumber = extra.viewCount || 2;
                ratingDoc.isRewatch = true;
                await runTransaction(db, async (transaction) => {
                    // ── ALL READS FIRST ──
                    const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];
                    for (const status of primaryStatuses) {
                        await transaction.get(doc(db, STATUS_COLLECTIONS[status], statusUniqueId));
                    }
                    const primaryRef = doc(db, "user_ratings", ratingDocId);
                    const primarySnap = await transaction.get(primaryRef);

                    const watchedRef = doc(db, "user_watched", statusUniqueId);
                    const watchedSnap = await transaction.get(watchedRef);

                    const statsSnap = statsRef ? await transaction.get(statsRef) : null;

                    const prevRatingVal = primarySnap.exists() ? Number(primarySnap.data()?.rating || 0) : 0;
                    const prevReviewVal = primarySnap.exists() ? String(primarySnap.data()?.review || "") : "";
                    const prevBucket = bucketFromRating(prevRatingVal);
                    const nextBucket = bucketFromRating(ratingDoc.rating);
                    const prevHadRating = Number(prevRatingVal || 0) > 0;
                    const nextHadRating = Number(ratingDoc.rating || 0) > 0;
                    const prevHadReview = prevReviewVal.trim().length > 0;
                    const nextHadReview = String(ratingDoc.review || "").trim().length > 0;
                    const prevWatched = watchedSnap.exists();

                    const statsData = statsSnap?.exists() ? (statsSnap.data() || {}) : {};
                    const nextBuckets = { ...(statsData.ratingBuckets || statsData.buckets || {}) };
                    const decBucket = (b) => {
                        if (!b) return;
                        const key = String(b);
                        nextBuckets[key] = Math.max(0, Number(nextBuckets[key] || 0) - 1);
                    };
                    const incBucket = (b) => {
                        if (!b) return;
                        const key = String(b);
                        nextBuckets[key] = Number(nextBuckets[key] || 0) + 1;
                    };

                    // Apply rating bucket diffs
                    if (prevBucket && nextBucket && String(prevBucket) !== String(nextBucket)) {
                        decBucket(prevBucket);
                        incBucket(nextBucket);
                    } else if (!prevBucket && nextBucket) {
                        incBucket(nextBucket);
                    }

                    const nextTotalRatings = Math.max(
                        0,
                        Number(statsData.totalRatings || 0) + (nextHadRating ? 1 : 0) - (prevHadRating ? 1 : 0)
                    );
                    const nextTotalReviews = Math.max(
                        0,
                        Number(statsData.totalReviews || 0) + (nextHadReview ? 1 : 0) - (prevHadReview ? 1 : 0)
                    );
                    const nextTotalWatchers = Math.max(
                        0,
                        Number(statsData.totalWatchers || 0) + (!prevWatched ? 1 : 0)
                    );

                    // ── ALL WRITES AFTER ──
                    const newRatingRef = doc(collection(db, "user_ratings"));
                    transaction.set(newRatingRef, ratingDoc);
                    if (primarySnap.exists()) {
                        transaction.update(primaryRef, { viewCount: extra.viewCount || 2 });
                    }
                    transaction.set(watchedRef, watchedDoc, { merge: true });
                    transaction.delete(doc(db, "user_watchlist", statusUniqueId));
                    transaction.delete(doc(db, "user_paused", statusUniqueId));
                    transaction.delete(doc(db, "user_dropped", statusUniqueId));

                    if (statsRef) {
                        transaction.set(
                            statsRef,
                            {
                                ratingBuckets: nextBuckets,
                                totalRatings: nextTotalRatings,
                                totalReviews: nextTotalReviews,
                                totalWatchers: nextTotalWatchers,
                            },
                            { merge: true }
                        );
                    }
                });
            } else {
                // Normal rate or edit: use deterministic doc ID
                await runTransaction(db, async (transaction) => {
                    // ── ALL READS FIRST ──
                    const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];
                    for (const status of primaryStatuses) {
                        await transaction.get(doc(db, STATUS_COLLECTIONS[status], statusUniqueId));
                    }

                    const ratingRef = doc(db, "user_ratings", ratingDocId);
                    const prevRatingSnap = await transaction.get(ratingRef);

                    const watchedRef = doc(db, "user_watched", statusUniqueId);
                    const watchedSnap = await transaction.get(watchedRef);

                    const statsSnap = statsRef ? await transaction.get(statsRef) : null;

                    const prevRatingVal = prevRatingSnap.exists() ? Number(prevRatingSnap.data()?.rating || 0) : 0;
                    const prevReviewVal = prevRatingSnap.exists() ? String(prevRatingSnap.data()?.review || "") : "";
                    const prevBucket = bucketFromRating(prevRatingVal);
                    const nextBucket = bucketFromRating(ratingDoc.rating);
                    const prevHadRating = Number(prevRatingVal || 0) > 0;
                    const nextHadRating = Number(ratingDoc.rating || 0) > 0;
                    const prevHadReview = prevReviewVal.trim().length > 0;
                    const nextHadReview = String(ratingDoc.review || "").trim().length > 0;
                    const prevWatched = watchedSnap.exists();

                    const statsData = statsSnap?.exists() ? (statsSnap.data() || {}) : {};
                    const nextBuckets = { ...(statsData.ratingBuckets || statsData.buckets || {}) };
                    const decBucket = (b) => {
                        if (!b) return;
                        const key = String(b);
                        nextBuckets[key] = Math.max(0, Number(nextBuckets[key] || 0) - 1);
                    };
                    const incBucket = (b) => {
                        if (!b) return;
                        const key = String(b);
                        nextBuckets[key] = Number(nextBuckets[key] || 0) + 1;
                    };

                    if (prevBucket && nextBucket && String(prevBucket) !== String(nextBucket)) {
                        decBucket(prevBucket);
                        incBucket(nextBucket);
                    } else if (!prevBucket && nextBucket) {
                        incBucket(nextBucket);
                    } else if (prevBucket && !nextBucket) {
                        decBucket(prevBucket);
                    }

                    const nextTotalRatings = Math.max(
                        0,
                        Number(statsData.totalRatings || 0) + (nextHadRating ? 1 : 0) - (prevHadRating ? 1 : 0)
                    );
                    const nextTotalReviews = Math.max(
                        0,
                        Number(statsData.totalReviews || 0) + (nextHadReview ? 1 : 0) - (prevHadReview ? 1 : 0)
                    );
                    const nextTotalWatchers = Math.max(
                        0,
                        Number(statsData.totalWatchers || 0) + (!prevWatched ? 1 : 0)
                    );

                    // ── ALL WRITES AFTER ──
                    transaction.set(ratingRef, ratingDoc, { merge: true });
                    transaction.set(watchedRef, watchedDoc, { merge: true });
                    transaction.delete(doc(db, "user_watchlist", statusUniqueId));
                    transaction.delete(doc(db, "user_paused", statusUniqueId));
                    transaction.delete(doc(db, "user_dropped", statusUniqueId));

                    if (statsRef) {
                        transaction.set(
                            statsRef,
                            {
                                ratingBuckets: nextBuckets,
                                totalRatings: nextTotalRatings,
                                totalReviews: nextTotalReviews,
                                totalWatchers: nextTotalWatchers,
                            },
                            { merge: true }
                        );
                    }
                });
            }

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
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
                    batch.set(doc(db, "user_ratings", ratingDocId), ratingDoc, { merge: true });
                }
                batch.set(doc(db, "user_watched", statusUniqueId), watchedDoc, { merge: true });
                batch.delete(doc(db, "user_watchlist", statusUniqueId));
                batch.delete(doc(db, "user_paused", statusUniqueId));
                batch.delete(doc(db, "user_dropped", statusUniqueId));
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

    async removeRating(user, mediaId, mediaType, options = {}) {
        if (!user) return false;
        const statusUniqueId = getUniqueId(user.uid, mediaType, mediaId);
        const ratingDocId = getRatingDocId(user.uid, mediaType, mediaId, options);
        if (!ratingDocId) return false;
        const statsRef = getStatsRef(mediaType, mediaId, options);
        try {
            // Use a transaction with all reads first, then writes
            await runTransaction(db, async (transaction) => {
                // ── ALL READS FIRST ──
                const ratingRef = doc(db, "user_ratings", ratingDocId);
                const ratingSnap = await transaction.get(ratingRef);

                const watchedRef = doc(db, "user_watched", statusUniqueId);
                const watchedSnap = await transaction.get(watchedRef);

                const statsSnap = statsRef ? await transaction.get(statsRef) : null;

                const statsData = statsSnap?.exists() ? (statsSnap.data() || {}) : {};
                const prevRatingVal = ratingSnap.exists() ? Number(ratingSnap.data()?.rating || 0) : 0;
                const prevReviewVal = ratingSnap.exists() ? String(ratingSnap.data()?.review || "") : "";
                const prevBucket = bucketFromRating(prevRatingVal);
                const prevHadRating = Number(prevRatingVal || 0) > 0;
                const prevHadReview = prevReviewVal.trim().length > 0;
                const prevWatched = watchedSnap.exists();

                const nextBuckets = { ...(statsData.ratingBuckets || statsData.buckets || {}) };
                if (prevBucket) {
                    const key = String(prevBucket);
                    nextBuckets[key] = Math.max(0, Number(nextBuckets[key] || 0) - 1);
                }

                const nextTotalRatings = Math.max(0, Number(statsData.totalRatings || 0) - (prevHadRating ? 1 : 0));
                const nextTotalReviews = Math.max(0, Number(statsData.totalReviews || 0) - (prevHadReview ? 1 : 0));
                const willRemoveWatched = options.keepWatchedIfNotCompleted === false;
                const nextTotalWatchers = Math.max(
                    0,
                    Number(statsData.totalWatchers || 0) - (willRemoveWatched && prevWatched ? 1 : 0)
                );

                // ── ALL WRITES AFTER ──
                if (ratingSnap.exists()) {
                    transaction.delete(ratingRef);
                }

                // If keepWatchedIfNotCompleted is explicitly false, also remove from watched
                if (options.keepWatchedIfNotCompleted === false) {
                    transaction.delete(watchedRef);
                }

                if (statsRef && ratingSnap.exists()) {
                    transaction.set(
                        statsRef,
                        {
                            ratingBuckets: nextBuckets,
                            totalRatings: nextTotalRatings,
                            totalReviews: nextTotalReviews,
                            totalWatchers: nextTotalWatchers,
                        },
                        { merge: true }
                    );
                }
            });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATING_REMOVED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            showToast.success("Rating removed");
            return true;
        } catch (error) {
            console.error("Error removing rating:", error);
            // Fallback: batch write
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, "user_ratings", ratingDocId));
                if (options.keepWatchedIfNotCompleted === false) {
                    batch.delete(doc(db, "user_watched", statusUniqueId));
                }
                await batch.commit();
                eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATING_REMOVED", userId: user.uid });
                eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
                showToast.success("Rating removed");
                return true;
            } catch (retryError) {
                console.error("Batch remove rating fallback failed:", retryError);
                showToast.error("Failed to remove rating");
                return false;
            }
        }
    },

    async getReview(user, mediaId, mediaType, options = {}) {
        if (!user) return null;
        const ratingDocId = getRatingDocId(user.uid, mediaType, mediaId, options);
        if (!ratingDocId) return null;
        try {
            const snap = await getDoc(doc(db, "user_ratings", ratingDocId));
            if (snap.exists()) {
                const data = snap.data();
                return {
                    rating: data.rating || 0,
                    review: data.review || "",
                    watchedDate: data.watchedDate || "",
                    liked: data.liked || false,
                    viewCount: data.viewCount || 1,
                    tags: data.tags || [],
                };
            }
            return null;
        } catch {
            return null;
        }
    },

    async getMediaStatus(user, mediaId, mediaType, options = {}) {
        if (!user) return {};
        const statusUniqueId = getUniqueId(user.uid, mediaType, mediaId);
        const ratingDocId = getRatingDocId(user.uid, mediaType, mediaId, options) || statusUniqueId;
        try {
            const [watched, watchlist, paused, dropped, rating] = await Promise.all([
                getDoc(doc(db, "user_watched", statusUniqueId)),
                getDoc(doc(db, "user_watchlist", statusUniqueId)),
                getDoc(doc(db, "user_paused", statusUniqueId)),
                getDoc(doc(db, "user_dropped", statusUniqueId)),
                getDoc(doc(db, "user_ratings", ratingDocId)),
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
