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
    increment,
    query,
    where,
    getDocs,
    onSnapshot,
    setDoc,
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

function getStatsDocId(mediaType, mediaId) {
    // For now we aggregate movie/tv via numeric mediaId.
    // Season/episode will use expanded keys once those media types are written.
    return `${mediaType}_${Number(mediaId)}`;
}

function getStatsRef(mediaType, mediaId) {
    if (!mediaType) return null;
    if (mediaType !== "movie" && mediaType !== "tv") return null;
    return doc(db, "media_stats", getStatsDocId(mediaType, mediaId));
}

function getUniqueId(userId, mediaType, mediaId) {
    return `${userId}_${mediaType}_${mediaId}`;
}

function getTVTargetKey(extra = {}) {
    const targetType = extra?.targetType || "series";
    const season = extra?.seasonNumber == null ? "all" : String(extra.seasonNumber);
    const episode = extra?.episodeNumber == null ? "all" : String(extra.episodeNumber);
    return `${targetType}_${season}_${episode}`;
}

function getRatingsDocId(userId, mediaType, mediaId, extra = {}) {
    if (mediaType === "tv") {
        return `${userId}_${mediaType}_${mediaId}_${getTVTargetKey(extra)}`;
    }
    return getUniqueId(userId, mediaType, mediaId);
}

function getWatchingDocId(userId, seriesId) {
    return `${userId}_tv_${seriesId}`;
}

function normalizeSeasonEpisodeCounts(map) {
    if (!map || typeof map !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(map)) {
        const key = String(k);
        const num = Number(v);
        if (!Number.isFinite(num) || num < 0) continue;
        out[key] = num;
    }
    return out;
}

function countRatedEpisodesForSeason(progress, seasonKey) {
    const ratedEpisodesBySeason = progress?.ratedEpisodesBySeason;
    if (ratedEpisodesBySeason && typeof ratedEpisodesBySeason === "object") {
        const seasonMap = ratedEpisodesBySeason[String(seasonKey)];
        if (seasonMap && typeof seasonMap === "object") {
            return Object.values(seasonMap).filter((v) => v === true).length;
        }
        return 0;
    }

    // Legacy fallback
    const ratedEpisodesCountBySeason = progress?.ratedEpisodesCountBySeason || {};
    return Number(ratedEpisodesCountBySeason[String(seasonKey)] || 0);
}

function isSeriesCompleted(progress) {
    if (!progress) return false;
    if (progress.completed === true) return true;
    if (progress.ratedSeries === true) return true;

    const totalSeasons = Number(progress.totalSeasons || 0);
    if (totalSeasons <= 0) return false;

    const ratedSeasons = progress.ratedSeasons || {};
    const allSeasonsRated = Array.from({ length: totalSeasons }, (_, i) => String(i + 1)).every(
        (s) => ratedSeasons[s] === true
    );

    const seasonEpisodeCounts = normalizeSeasonEpisodeCounts(progress.seasonEpisodeCounts);
    const allEpisodesRated = Array.from({ length: totalSeasons }, (_, i) => String(i + 1)).every((s) => {
        const need = Number(seasonEpisodeCounts[s] || 0);
        if (need <= 0) return false;
        const have = countRatedEpisodesForSeason(progress, s);
        return have >= need;
    });

    return allSeasonsRated || allEpisodesRated;
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

            // Watchers aggregation: treat "watchers" as current watchers (users in user_watched)
            const watchedRef = doc(db, "user_watched", uniqueId);
            const watchedSnap = await transaction.get(watchedRef);
            const wasWatched = watchedSnap.exists();

            const statsRef = getStatsRef(mediaType, mediaId);

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

            if (statsRef) {
                if (targetStatus === "watched" && !wasWatched) {
                    transaction.set(statsRef, { totalWatchers: increment(1) }, { merge: true });
                }
                if (targetStatus !== "watched" && wasWatched) {
                    transaction.set(statsRef, { totalWatchers: increment(-1) }, { merge: true });
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

    async isWatching(user, seriesId) {
        if (!user || !seriesId) return false;
        try {
            const snap = await getDoc(doc(db, "user_watching", getWatchingDocId(user.uid, Number(seriesId))));
            return snap.exists();
        } catch {
            return false;
        }
    },

    async addToWatching(user, seriesId, data) {
        if (!user || !seriesId) return false;
        const docId = getWatchingDocId(user.uid, Number(seriesId));
        try {
            await setDoc(doc(db, "user_watching", docId), {
                userId: user.uid,
                mediaType: "tv",
                seriesId: Number(seriesId),
                title: data?.title || "",
                poster_path: data?.poster_path || "",
                startedAt: serverTimestamp(),
                currentSeason: data?.currentSeason ?? null,
                currentEpisode: data?.currentEpisode ?? null,
            }, { merge: true });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            return true;
        } catch (e) {
            console.error("Error adding to watching:", e);
            return false;
        }
    },

    async removeFromWatching(user, seriesId) {
        if (!user || !seriesId) return false;
        try {
            await deleteDoc(doc(db, "user_watching", getWatchingDocId(user.uid, Number(seriesId))));
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            return true;
        } catch (e) {
            console.error("Error removing from watching:", e);
            return false;
        }
    },

    async rateMedia(user, mediaId, mediaType, rating, mediaData, reviewText = "", extra = {}) {
        if (!user) return false;
        const uniqueId = getRatingsDocId(user.uid, mediaType, mediaId, extra);
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

        if (mediaType === "tv") {
            ratingDoc.targetType = extra.targetType || "series";
            ratingDoc.seriesId = Number(extra.seriesId ?? mediaId);
            ratingDoc.seasonNumber = extra.seasonNumber ?? null;
            ratingDoc.episodeNumber = extra.episodeNumber ?? null;
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

        // NOTE: For TV, we must NOT add to user_watched unless the series is completed.
        // watchedDoc will only be used for movies here; for TV completion we'll write series-only watched doc later.

        try {
            if (isRateAgain) {
                // Rate Again: create a new doc with auto-generated ID
                ratingDoc.watchNumber = extra.viewCount || 2;
                ratingDoc.isRewatch = true;
                await runTransaction(db, async (transaction) => {
                    // ── ALL READS FIRST ──
                    const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];
                    for (const status of primaryStatuses) {
                        await transaction.get(doc(db, STATUS_COLLECTIONS[status], uniqueId));
                    }
                    const primaryRef = doc(db, "user_ratings", uniqueId);
                    const primarySnap = await transaction.get(primaryRef);

                    const statsRef = getStatsRef(mediaType, mediaId);

                    const progressRef = mediaType === "tv"
                        ? doc(db, "user_series_progress", `${user.uid}_${Number(extra.seriesId ?? mediaId)}`)
                        : null;

                    // ── ALL WRITES AFTER ──
                    const newRatingRef = doc(collection(db, "user_ratings"));
                    transaction.set(newRatingRef, ratingDoc);
                    if (primarySnap.exists()) {
                        transaction.update(primaryRef, { viewCount: extra.viewCount || 2 });
                    }
                    if (mediaType !== "tv") {
                        transaction.set(doc(db, "user_watched", uniqueId), watchedDoc, { merge: true });
                    }
                    transaction.delete(doc(db, "user_watchlist", uniqueId));
                    transaction.delete(doc(db, "user_paused", uniqueId));
                    transaction.delete(doc(db, "user_dropped", uniqueId));

                    // Stats update (rate again counts as another rating entry)
                    if (statsRef) {
                        const newBucket = bucketFromRating(ratingDoc.rating);
                        const hasReview = typeof ratingDoc.review === "string" && ratingDoc.review.trim().length > 0;

                        const incObj = {
                            totalRatings: increment(newBucket ? 1 : 0),
                            totalReviews: increment(hasReview ? 1 : 0),
                        };
                        if (newBucket) {
                            incObj[`ratingBuckets.${String(newBucket)}`] = increment(1);
                        }
                        transaction.set(statsRef, incObj, { merge: true });
                    }

                    // For TV: update progress + complete checks. (RateAgain counts as activity but doesn't change completion deterministically)
                    if (progressRef) {
                        const progressSnap = await transaction.get(progressRef);
                        const prevProgress = progressSnap.exists() ? (progressSnap.data() || {}) : {};
                        const seriesIdNum = Number(extra.seriesId ?? mediaId);
                        const next = {
                            userId: user.uid,
                            seriesId: seriesIdNum,
                            title: mediaData.title || mediaData.name || "",
                            poster_path: mediaData.poster_path || "",
                            totalSeasons: extra.totalSeasons ?? prevProgress.totalSeasons ?? null,
                            seasonEpisodeCounts: normalizeSeasonEpisodeCounts(extra.seasonEpisodeCounts || prevProgress.seasonEpisodeCounts),
                            ratedSeries: prevProgress.ratedSeries || false,
                            ratedSeasons: prevProgress.ratedSeasons || {},
                            ratedEpisodesBySeason: prevProgress.ratedEpisodesBySeason || {},
                            ratedEpisodesCountBySeason: prevProgress.ratedEpisodesCountBySeason || {},
                            updatedAt: serverTimestamp(),
                        };

                        // IMPORTANT: RateAgain should not advance completion progress for season/episode.
                        // (Those progress fields are intended to represent one-by-one coverage, not rewatches.)
                        if ((extra.targetType || "series") === "series") {
                            next.ratedSeries = true;
                        }

                        const completed = isSeriesCompleted(next);
                        if (completed && prevProgress.completed !== true) {
                            next.completed = true;
                            next.completedAt = serverTimestamp();

                            // Add series to watched (series poster only)
                            const seriesWatchedId = getUniqueId(user.uid, "tv", seriesIdNum);
                            transaction.set(doc(db, "user_watched", seriesWatchedId), {
                                userId: user.uid,
                                mediaId: seriesIdNum,
                                mediaType: "tv",
                                title: mediaData.title || mediaData.name || "",
                                poster_path: mediaData.poster_path || "",
                                addedAt: serverTimestamp(),
                            }, { merge: true });

                            // Remove from watching
                            transaction.delete(doc(db, "user_watching", getWatchingDocId(user.uid, seriesIdNum)));
                        }

                        transaction.set(progressRef, next, { merge: true });
                    }
                });
            } else {
                // Normal rate or edit: use deterministic doc ID
                await runTransaction(db, async (transaction) => {
                    // ── ALL READS FIRST ──
                    const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];
                    for (const status of primaryStatuses) {
                        await transaction.get(doc(db, STATUS_COLLECTIONS[status], uniqueId));
                    }

                    const primaryRef = doc(db, "user_ratings", uniqueId);
                    const primarySnap = await transaction.get(primaryRef);
                    const prev = primarySnap.exists() ? (primarySnap.data() || {}) : null;

                    const statsRef = getStatsRef(mediaType, mediaId);

                    const progressRef = mediaType === "tv"
                        ? doc(db, "user_series_progress", `${user.uid}_${Number(extra.seriesId ?? mediaId)}`)
                        : null;

                    let prevProgress = null;
                    if (progressRef) {
                        const progressSnap = await transaction.get(progressRef);
                        prevProgress = progressSnap.exists() ? (progressSnap.data() || {}) : {};
                    }

                    // ── ALL WRITES AFTER ──
                    transaction.set(doc(db, "user_ratings", uniqueId), ratingDoc, { merge: true });
                    if (mediaType !== "tv") {
                        transaction.set(doc(db, "user_watched", uniqueId), watchedDoc, { merge: true });
                    }
                    transaction.delete(doc(db, "user_watchlist", uniqueId));
                    transaction.delete(doc(db, "user_paused", uniqueId));
                    transaction.delete(doc(db, "user_dropped", uniqueId));

                    if (statsRef) {
                        const prevBucket = bucketFromRating(prev?.rating);
                        const nextBucket = bucketFromRating(ratingDoc.rating);
                        const prevHasReview = typeof prev?.review === "string" && prev.review.trim().length > 0;
                        const nextHasReview = typeof ratingDoc.review === "string" && ratingDoc.review.trim().length > 0;

                        const incObj = {};

                        // totalRatings: increment only when creating first rating entry with a valid bucket
                        if (!prev && nextBucket) incObj.totalRatings = increment(1);
                        if (prevBucket && !nextBucket) incObj.totalRatings = increment(-1);
                        if (!prevBucket && nextBucket && prev) incObj.totalRatings = increment(1);

                        // bucket deltas
                        if (prevBucket && prevBucket !== nextBucket) {
                            incObj[`ratingBuckets.${String(prevBucket)}`] = increment(-1);
                        }
                        if (nextBucket && prevBucket !== nextBucket) {
                            incObj[`ratingBuckets.${String(nextBucket)}`] = increment(1);
                        }

                        // totalReviews delta
                        if (!prevHasReview && nextHasReview) incObj.totalReviews = increment(1);
                        if (prevHasReview && !nextHasReview) incObj.totalReviews = increment(-1);

                        // Initialize stats doc if needed and apply deltas
                        transaction.set(statsRef, incObj, { merge: true });
                    }

                    // TV completion tracking + watched/watching sync
                    if (progressRef) {
                        const seriesIdNum = Number(extra.seriesId ?? mediaId);
                        const next = {
                            userId: user.uid,
                            seriesId: seriesIdNum,
                            title: mediaData.title || mediaData.name || "",
                            poster_path: mediaData.poster_path || "",
                            totalSeasons: extra.totalSeasons ?? prevProgress.totalSeasons ?? null,
                            seasonEpisodeCounts: normalizeSeasonEpisodeCounts(extra.seasonEpisodeCounts || prevProgress.seasonEpisodeCounts),
                            ratedSeries: prevProgress.ratedSeries || false,
                            ratedSeasons: prevProgress.ratedSeasons || {},
                            ratedEpisodesBySeason: prevProgress.ratedEpisodesBySeason || {},
                            ratedEpisodesCountBySeason: prevProgress.ratedEpisodesCountBySeason || {},
                            completed: prevProgress.completed || false,
                            updatedAt: serverTimestamp(),
                        };

                        const targetType = extra.targetType || "series";
                        if (targetType === "series") {
                            next.ratedSeries = true;
                        }
                        if (targetType === "season" && extra.seasonNumber != null) {
                            next.ratedSeasons[String(extra.seasonNumber)] = true;
                        }
                        if (targetType === "episode" && extra.seasonNumber != null) {
                            const seasonKey = String(extra.seasonNumber);
                            const episodeKey = extra.episodeNumber != null ? String(extra.episodeNumber) : null;

                            // Deterministic: mark the specific episode as rated.
                            if (episodeKey) {
                                const seasonMap = {
                                    ...((next.ratedEpisodesBySeason && typeof next.ratedEpisodesBySeason === "object")
                                        ? (next.ratedEpisodesBySeason[seasonKey] || {})
                                        : {}),
                                };
                                seasonMap[episodeKey] = true;
                                next.ratedEpisodesBySeason = {
                                    ...(next.ratedEpisodesBySeason || {}),
                                    [seasonKey]: seasonMap,
                                };

                                // Keep legacy counter roughly in sync for older clients.
                                const haveLegacy = Number(next.ratedEpisodesCountBySeason[seasonKey] || 0);
                                if (!prev) {
                                    next.ratedEpisodesCountBySeason[seasonKey] = haveLegacy + 1;
                                }
                            }
                        }

                        const completed = isSeriesCompleted(next);
                        if (completed && prevProgress.completed !== true) {
                            next.completed = true;
                            next.completedAt = serverTimestamp();

                            const seriesWatchedId = getUniqueId(user.uid, "tv", seriesIdNum);
                            transaction.set(doc(db, "user_watched", seriesWatchedId), {
                                userId: user.uid,
                                mediaId: seriesIdNum,
                                mediaType: "tv",
                                title: mediaData.title || mediaData.name || "",
                                poster_path: mediaData.poster_path || "",
                                addedAt: serverTimestamp(),
                            }, { merge: true });
                            transaction.delete(doc(db, "user_watching", getWatchingDocId(user.uid, seriesIdNum)));
                        }

                        transaction.set(progressRef, next, { merge: true });
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
                    batch.set(doc(db, "user_ratings", uniqueId), ratingDoc, { merge: true });
                }
                if (mediaType !== "tv") {
                    batch.set(doc(db, "user_watched", uniqueId), watchedDoc, { merge: true });
                }
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

    async removeRating(user, mediaId, mediaType, target = {}) {
        if (!user) return false;
        const uniqueId = getRatingsDocId(
            user.uid,
            mediaType,
            mediaId,
            mediaType === "tv"
                ? {
                    targetType: target.targetType || "series",
                    seasonNumber: target.seasonNumber ?? null,
                    episodeNumber: target.episodeNumber ?? null,
                }
                : {}
        );
        try {
            await runTransaction(db, async (transaction) => {
                const ratingRef = doc(db, "user_ratings", uniqueId);
                const ratingSnap = await transaction.get(ratingRef);
                const prev = ratingSnap.exists() ? (ratingSnap.data() || {}) : null;

                const statsRef = getStatsRef(mediaType, mediaId);

                const seriesIdNum = mediaType === "tv" ? Number(target.seriesId ?? mediaId) : null;
                const progressRef = mediaType === "tv" && seriesIdNum
                    ? doc(db, "user_series_progress", `${user.uid}_${seriesIdNum}`)
                    : null;
                const watchedSeriesRef = mediaType === "tv" && seriesIdNum
                    ? doc(db, "user_watched", getUniqueId(user.uid, "tv", seriesIdNum))
                    : null;

                let prevProgress = null;
                if (progressRef) {
                    const progressSnap = await transaction.get(progressRef);
                    prevProgress = progressSnap.exists() ? (progressSnap.data() || {}) : {};
                }

                if (statsRef && prev) {
                    const prevBucket = bucketFromRating(prev.rating);
                    const prevHasReview = typeof prev.review === "string" && prev.review.trim().length > 0;

                    const incObj = {};
                    if (prevBucket) {
                        incObj.totalRatings = increment(-1);
                        incObj[`ratingBuckets.${String(prevBucket)}`] = increment(-1);
                    }
                    if (prevHasReview) {
                        incObj.totalReviews = increment(-1);
                    }

                    transaction.set(statsRef, incObj, { merge: true });
                }

                transaction.delete(ratingRef);

                if (progressRef) {
                    const next = {
                        ...prevProgress,
                        userId: user.uid,
                        seriesId: seriesIdNum,
                        updatedAt: serverTimestamp(),
                    };

                    const tType = target.targetType || "series";
                    if (tType === "series") {
                        next.ratedSeries = false;
                    }
                    if (tType === "season" && target.seasonNumber != null) {
                        next.ratedSeasons = { ...(next.ratedSeasons || {}) };
                        next.ratedSeasons[String(target.seasonNumber)] = false;
                    }
                    if (tType === "episode" && target.seasonNumber != null) {
                        const seasonKey = String(target.seasonNumber);
                        const episodeKey = target.episodeNumber != null ? String(target.episodeNumber) : null;

                        if (episodeKey) {
                            next.ratedEpisodesBySeason = { ...(next.ratedEpisodesBySeason || {}) };
                            const prevSeasonMap = (next.ratedEpisodesBySeason[seasonKey] && typeof next.ratedEpisodesBySeason[seasonKey] === "object")
                                ? next.ratedEpisodesBySeason[seasonKey]
                                : {};
                            const seasonMap = { ...prevSeasonMap };
                            delete seasonMap[episodeKey];
                            next.ratedEpisodesBySeason[seasonKey] = seasonMap;
                        }

                        // Legacy counter best-effort decrement
                        next.ratedEpisodesCountBySeason = { ...(next.ratedEpisodesCountBySeason || {}) };
                        const have = Number(next.ratedEpisodesCountBySeason[seasonKey] || 0);
                        next.ratedEpisodesCountBySeason[seasonKey] = Math.max(0, have - 1);
                    }

                    // Recompute completion based on updated progress.
                    const nowCompleted = isSeriesCompleted({ ...next, completed: false });
                    next.completed = nowCompleted;
                    if (nowCompleted) {
                        if (!prevProgress?.completedAt) next.completedAt = serverTimestamp();
                        // Ensure watched present when still completed
                        if (watchedSeriesRef) {
                            transaction.set(watchedSeriesRef, {
                                userId: user.uid,
                                mediaId: seriesIdNum,
                                mediaType: "tv",
                                title: next.title || prev?.title || "",
                                poster_path: next.poster_path || prev?.poster_path || "",
                                addedAt: serverTimestamp(),
                            }, { merge: true });
                        }
                    } else {
                        // Not completed anymore: apply user confirmation for keeping in watched
                        if (target.keepWatchedIfNotCompleted === true) {
                            next.manualWatched = true;
                            if (watchedSeriesRef) {
                                transaction.set(watchedSeriesRef, {
                                    userId: user.uid,
                                    mediaId: seriesIdNum,
                                    mediaType: "tv",
                                    title: next.title || prev?.title || "",
                                    poster_path: next.poster_path || prev?.poster_path || "",
                                    addedAt: serverTimestamp(),
                                }, { merge: true });
                            }
                        } else if (target.keepWatchedIfNotCompleted === false) {
                            next.manualWatched = false;
                            if (watchedSeriesRef) {
                                transaction.delete(watchedSeriesRef);
                            }
                        }
                    }

                    transaction.set(progressRef, next, { merge: true });
                }
            });
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

    async getReview(user, mediaId, mediaType, target = {}) {
        if (!user) return null;
        const uniqueId = getRatingsDocId(
            user.uid,
            mediaType,
            mediaId,
            mediaType === "tv"
                ? {
                    targetType: target.targetType || "series",
                    seasonNumber: target.seasonNumber ?? null,
                    episodeNumber: target.episodeNumber ?? null,
                }
                : {}
        );
        try {
            const snap = await getDoc(doc(db, "user_ratings", uniqueId));
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

    async getMediaStatus(user, mediaId, mediaType) {
        if (!user) return {};
        const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
        const ratingId = mediaType === "tv"
            ? getRatingsDocId(user.uid, mediaType, mediaId, { targetType: "series" })
            : uniqueId;
        try {
            const [watched, watchlist, paused, dropped, rating, watching] = await Promise.all([
                getDoc(doc(db, "user_watched", uniqueId)),
                getDoc(doc(db, "user_watchlist", uniqueId)),
                getDoc(doc(db, "user_paused", uniqueId)),
                getDoc(doc(db, "user_dropped", uniqueId)),
                getDoc(doc(db, "user_ratings", ratingId)),
                mediaType === "tv"
                    ? getDoc(doc(db, "user_watching", getWatchingDocId(user.uid, Number(mediaId))))
                    : Promise.resolve(null),
            ]);
            return {
                isWatched: watched.exists(),
                isWatchlist: watchlist.exists(),
                isPaused: paused.exists(),
                isDropped: dropped.exists(),
                rating: rating.exists() ? rating.data().rating : 0,
                hasEntry: rating.exists(),
                isWatching: mediaType === "tv" ? !!watching?.exists?.() : false,
            };
        } catch (error) {
            console.error("Error fetching media status:", error);
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
                { name: "user_watching", key: "watching" },
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
        const keys = ["watched", "watching", "paused", "dropped", "watchlist", "ratings"];
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
