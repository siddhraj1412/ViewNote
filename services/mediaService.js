import { tmdb } from "@/lib/tmdb";
import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";
import showToast from "@/lib/toast";
import { aggregateAndWriteStats } from "@/lib/statsService";
import { reviewService } from "@/services/reviewService";

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// ID Helpers
// ═══════════════════════════════════════════════════════════════════

function getUniqueId(userId, mediaType, mediaId) {
    return `${userId}_${mediaType}_${mediaId}`;
}

/**
 * Scope-aware doc ID for TV ratings/reviews.
 *   Series: userId_tv_mediaId
 *   Season: userId_tv_mediaId_season_N
 *   Episode: userId_tv_mediaId_sNeM
 *   Movie:  userId_movie_mediaId
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
 * Scope-aware stats key.
 *   Series/movie: mediaType_mediaId
 *   Season:       tv_mediaId_season_N
 *   Episode:      tv_mediaId_sNeM
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
        [timestampField]: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════
// Transition Status (atomic via RPC with fallback)
// ═══════════════════════════════════════════════════════════════════

async function transitionStatus(user, mediaId, mediaType, mediaData, targetStatus, extraData = {}) {
    if (!user) {
        showToast.info("Please sign in first");
        return false;
    }

    const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
    const primaryStatuses = ["watched", "watchlist", "paused", "dropped"];

    try {
        const { error } = await supabase.rpc("transition_media_status", {
            p_id: uniqueId,
            p_user_id: user.uid,
            p_media_id: Number(mediaId),
            p_media_type: mediaType,
            p_target_status: targetStatus,
            p_title: mediaData.title || mediaData.name || "",
            p_poster_path: mediaData.poster_path || "",
        });

        if (error) throw error;

        if (Object.keys(extraData).length > 0) {
            await supabase
                .from(STATUS_COLLECTIONS[targetStatus])
                .update(extraData)
                .eq("id", uniqueId);
        }

        eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: targetStatus.toUpperCase(), userId: user.uid });
        eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
        return true;
    } catch (error) {
        console.error(`[MediaService] RPC transition failed for ${targetStatus}:`, error);

        // Fallback: sequential operations
        try {
            for (const status of primaryStatuses) {
                if (status !== targetStatus) {
                    await supabase.from(STATUS_COLLECTIONS[status]).delete().eq("id", uniqueId);
                }
            }
            const timestampField = TIMESTAMP_FIELDS[targetStatus];
            const docData = {
                id: uniqueId,
                ...buildDocData(user, mediaId, mediaType, mediaData, timestampField),
                ...extraData,
            };
            await supabase.from(STATUS_COLLECTIONS[targetStatus]).upsert(docData, { onConflict: "id" });

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: targetStatus.toUpperCase(), userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            return true;
        } catch (retryError) {
            console.error(`[MediaService] Fallback also failed:`, retryError);
            showToast.error("Failed to update status. Please try again.");
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Exported Service
// ═══════════════════════════════════════════════════════════════════

export const mediaService = {
    // ── Details & Images ──

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

    // ── Status Transitions ──

    async markAsWatched(user, mediaId, mediaType, mediaData) {
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "watched");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || "Item"}" saved to your profile`, `/${uname}`);
        }
        return success;
    },

    async addToWatchlist(user, mediaId, mediaType, mediaData) {
        if (!user) { showToast.info("Please sign in first"); return false; }
        const uniqueId = getUniqueId(user.uid, mediaType, mediaId);
        try {
            const { data: existing } = await supabase
                .from("user_watchlist")
                .select("id")
                .eq("id", uniqueId)
                .maybeSingle();
            if (existing) { showToast.info("Already in watchlist"); return false; }
        } catch (_) {}
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "watchlist");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || "Item"}" added to watchlist`, `/${uname}?tab=watchlist`);
        }
        return success;
    },

    async pauseMedia(user, mediaId, mediaType, mediaData) {
        if (!user) return false;
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "paused");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || "Item"}" paused`, `/${uname}?tab=paused`);
        }
        return success;
    },

    async dropMedia(user, mediaId, mediaType, mediaData) {
        if (!user) return false;
        const success = await transitionStatus(user, mediaId, mediaType, mediaData, "dropped");
        if (success) {
            const uname = user.username || user.uid;
            showToast.linked(`"${mediaData.title || mediaData.name || "Item"}" dropped`, `/${uname}?tab=dropped`);
        }
        return success;
    },

    // ── Rating ──

    async rateMedia(user, mediaId, mediaType, rating, mediaData, reviewText = "", extra = {}) {
        if (!user) return false;
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
            ratedAt: new Date().toISOString(),
            username: user.username || "",
        };

        if (extra.watchedDate) ratingDoc.watchedDate = extra.watchedDate;
        if (typeof extra.liked === "boolean") ratingDoc.liked = extra.liked;
        if (typeof extra.viewCount === "number" && extra.viewCount > 0) ratingDoc.viewCount = extra.viewCount;
        if (Array.isArray(extra.tags)) ratingDoc.tags = extra.tags;
        if (typeof extra.spoiler === "boolean") ratingDoc.spoiler = extra.spoiler;

        const targetType = extra.targetType || extra.tvTargetType || null;
        const seasonNumber = extra.seasonNumber ?? extra.tvSeasonNumber ?? null;
        const episodeNumber = extra.episodeNumber ?? extra.tvEpisodeNumber ?? null;
        if (targetType) ratingDoc.tvTargetType = targetType;
        if (typeof seasonNumber === "number") ratingDoc.tvSeasonNumber = seasonNumber;
        if (typeof episodeNumber === "number") ratingDoc.tvEpisodeNumber = episodeNumber;
        if (extra.seriesId) ratingDoc.seriesId = Number(extra.seriesId);

        try {
            if (isRateAgain) {
                // Rate Again: new doc with unique ID
                ratingDoc.watchNumber = extra.viewCount || 2;
                ratingDoc.isRewatch = true;
                const newId = `${scopedId}_rw${Date.now()}`;
                ratingDoc.id = newId;
                const { error } = await supabase.from("user_ratings").insert(ratingDoc);
                if (error) throw error;
                // Update viewCount on the primary rating
                await supabase.from("user_ratings").update({ viewCount: extra.viewCount || 2 }).eq("id", scopedId);
            } else {
                // Normal rate or edit
                ratingDoc.id = scopedId;
                const { error } = await supabase.from("user_ratings").upsert(ratingDoc, { onConflict: "id" });
                if (error) throw error;

                // Auto-mark as watched + clear conflicting statuses
                const watchedDoc = {
                    id: seriesBaseId,
                    userId: user.uid,
                    mediaId: Number(mediaId),
                    mediaType,
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    addedAt: new Date().toISOString(),
                };
                await supabase.from("user_watched").upsert(watchedDoc, { onConflict: "id" });
                await Promise.all([
                    supabase.from("user_watchlist").delete().eq("id", seriesBaseId),
                    supabase.from("user_paused").delete().eq("id", seriesBaseId),
                    supabase.from("user_dropped").delete().eq("id", seriesBaseId),
                ]);
            }

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });

            const statsId = getScopedStatsId(mediaId, mediaType, extra);
            aggregateAndWriteStats(mediaId, mediaType, statsId, { targetType, seasonNumber, episodeNumber }).catch(() => {});

            // Propagate watch state for TV
            if (mediaType === "tv" && (!targetType || targetType === "series")) {
                this._propagateSeriesWatched(user, mediaId, mediaData).catch((err) => {
                    console.error("[MediaService] Series watch propagation error:", err);
                });
            } else if (mediaType === "tv" && targetType === "season" && seasonNumber != null) {
                this._propagateSeasonWatched(user, mediaId, mediaData, seasonNumber, extra.seasonEpisodeCounts).catch((err) => {
                    console.error("[MediaService] Season watch propagation error:", err);
                });
            }

            showToast.linked(
                `"${mediaData.title || mediaData.name || "Item"}" rated - saved to your profile`,
                `/${user.username || user.uid}`
            );
            return true;
        } catch (error) {
            console.error("Error rating media:", error);
            showToast.error("Failed to save rating");
            return false;
        }
    },

    async removeRating(user, mediaId, mediaType, options = {}) {
        if (!user) return false;
        const scopedId = getScopedId(user.uid, mediaType, mediaId, options);
        const seriesBaseId = getUniqueId(user.uid, mediaType, mediaId);
        try {
            await supabase.from("user_ratings").delete().eq("id", scopedId);
            if (options.keepWatchedIfNotCompleted === false) {
                await supabase.from("user_watched").delete().eq("id", seriesBaseId);
            }

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType, action: "RATING_REMOVED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            const statsId = getScopedStatsId(mediaId, mediaType, options);
            aggregateAndWriteStats(mediaId, mediaType, statsId, options).catch(() => {});
            reviewService.deleteReviewThread(scopedId).catch((e) =>
                console.warn("[mediaService] Failed to cascade-delete review thread:", e)
            );
            showToast.success("Rating removed");
            return true;
        } catch (error) {
            console.error("Error removing rating:", error);
            showToast.error("Failed to remove rating");
            return false;
        }
    },

    // ── Get Review / Status ──

    async getReview(user, mediaId, mediaType, scopeOpts = {}) {
        if (!user) return null;
        const scopedId = getScopedId(user.uid, mediaType, mediaId, scopeOpts);
        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("id", scopedId)
                .maybeSingle();

            if (error || !data) return null;
            return {
                rating: data.rating || 0,
                review: data.review || "",
                watchedDate: data.watchedDate || "",
                liked: data.liked || false,
                viewCount: data.viewCount || 1,
                tags: data.tags || [],
                spoiler: data.spoiler || false,
            };
        } catch {
            return null;
        }
    },

    async getMediaStatus(user, mediaId, mediaType, scopeOpts = {}) {
        if (!user) return {};
        const baseId = getUniqueId(user.uid, mediaType, mediaId);
        const ratingId = getScopedId(user.uid, mediaType, mediaId, scopeOpts);
        try {
            const [watchedRes, watchlistRes, pausedRes, droppedRes, ratingRes] = await Promise.all([
                supabase.from("user_watched").select("id").eq("id", baseId).maybeSingle(),
                supabase.from("user_watchlist").select("id").eq("id", baseId).maybeSingle(),
                supabase.from("user_paused").select("id").eq("id", baseId).maybeSingle(),
                supabase.from("user_dropped").select("id").eq("id", baseId).maybeSingle(),
                supabase.from("user_ratings").select("id, rating").eq("id", ratingId).maybeSingle(),
            ]);
            return {
                isWatched: !!watchedRes.data,
                isWatchlist: !!watchlistRes.data,
                isPaused: !!pausedRes.data,
                isDropped: !!droppedRes.data,
                rating: ratingRes.data?.rating || 0,
                hasEntry: !!ratingRes.data,
            };
        } catch (error) {
            console.error("Error checking status:", error);
            return {};
        }
    },

    // ── Realtime Listeners (Supabase Channels) ──

    attachProfileListeners(userId, onUpdate) {
        if (!userId) return () => {};

        if (!activeListeners[userId]) {
            activeListeners[userId] = { channels: [], refCount: 0 };

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
                    const channel = supabase
                        .channel(`${col.name}_${userId}`)
                        .on(
                            "postgres_changes",
                            { event: "*", schema: "public", table: col.name, filter: `userId=eq.${userId}` },
                            async () => {
                                // Re-fetch the full list on any change
                                const { data } = await supabase
                                    .from(col.name)
                                    .select("*")
                                    .eq("userId", userId);
                                eventBus.emit(`${col.key.toUpperCase()}_SNAPSHOT`, { items: data || [], userId });
                            }
                        )
                        .subscribe();
                    activeListeners[userId].channels.push(channel);
                } catch (error) {
                    console.error(`[MediaService] Failed to attach listener for ${col.name}:`, error);
                }
            }
        }

        activeListeners[userId].refCount++;

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
            for (const key of keys) {
                eventBus.off(`${key.toUpperCase()}_SNAPSHOT`, handlers[key]);
            }
            if (activeListeners[userId]) {
                activeListeners[userId].refCount--;
                if (activeListeners[userId].refCount <= 0) {
                    activeListeners[userId].channels.forEach((ch) => supabase.removeChannel(ch));
                    delete activeListeners[userId];
                }
            }
        };
    },

    detachProfileListeners(userId) {
        if (activeListeners[userId]) {
            activeListeners[userId].channels.forEach((ch) => supabase.removeChannel(ch));
            delete activeListeners[userId];
        }
    },

    // ── Batch Fetch ──

    async fetchAllUserMedia(userId) {
        if (!userId) return { watched: [], paused: [], dropped: [], watchlist: [], ratings: [] };
        try {
            const [watchedRes, pausedRes, droppedRes, watchlistRes, ratingsRes] = await Promise.all([
                supabase.from("user_watched").select("*").eq("userId", userId),
                supabase.from("user_paused").select("*").eq("userId", userId),
                supabase.from("user_dropped").select("*").eq("userId", userId),
                supabase.from("user_watchlist").select("*").eq("userId", userId),
                supabase.from("user_ratings").select("*").eq("userId", userId),
            ]);
            return {
                watched: watchedRes.data || [],
                paused: pausedRes.data || [],
                dropped: droppedRes.data || [],
                watchlist: watchlistRes.data || [],
                ratings: ratingsRes.data || [],
            };
        } catch (error) {
            console.error("[MediaService] Error batch fetching user media:", error);
            return { watched: [], paused: [], dropped: [], watchlist: [], ratings: [] };
        }
    },

    async getUserSeenMediaIds(userId) {
        if (!userId) return new Set();
        try {
            const [watchedRes, ratingsRes, favsRes] = await Promise.all([
                supabase.from("user_watched").select("mediaId").eq("userId", userId),
                supabase.from("user_ratings").select("mediaId").eq("userId", userId),
                supabase.from("favorites").select("mediaId").eq("userId", userId),
            ]);
            const ids = new Set();
            (watchedRes.data || []).forEach((d) => ids.add(Number(d.mediaId)));
            (ratingsRes.data || []).forEach((d) => ids.add(Number(d.mediaId)));
            (favsRes.data || []).forEach((d) => ids.add(Number(d.mediaId)));
            return ids;
        } catch (error) {
            console.error("[MediaService] Error fetching seen IDs:", error);
            return new Set();
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // TV SERIES / SEASON / EPISODE WATCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async getSeriesProgress(user, mediaId) {
        if (!user?.uid || !mediaId) return { watchedSeasons: [], watchedEpisodes: {} };
        const progressId = `${user.uid}_${Number(mediaId)}`;
        try {
            const { data, error } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .maybeSingle();

            if (error || !data) return { watchedSeasons: [], watchedEpisodes: {} };
            return {
                watchedSeasons: Array.isArray(data.watchedSeasons) ? data.watchedSeasons.map(Number) : [],
                watchedEpisodes: data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? data.watchedEpisodes : {},
            };
        } catch (error) {
            console.error("[MediaService] getSeriesProgress error:", error);
            return { watchedSeasons: [], watchedEpisodes: {} };
        }
    },

    async markTVSeasonsWatchedBulk(user, mediaId, seriesData, seasonNumbers, seasonEpisodeCounts = {}, options = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;
        const seriesWatchedId = getUniqueId(user.uid, "tv", mediaId);

        try {
            // Fetch existing progress
            const { data: existing } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .maybeSingle();

            const existingEpisodes = existing?.watchedEpisodes && typeof existing.watchedEpisodes === "object"
                ? { ...existing.watchedEpisodes }
                : {};

            const allSeasons = Array.from(new Set(seasonNumbers.map(Number)));
            for (const sn of allSeasons) {
                const epCount = Number(seasonEpisodeCounts[String(sn)] || 0);
                if (epCount > 0) {
                    existingEpisodes[String(sn)] = Array.from({ length: epCount }, (_, i) => i + 1);
                }
            }

            // Upsert progress
            await supabase.from("user_series_progress").upsert(
                {
                    id: progressId,
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons: allSeasons,
                    watchedEpisodes: existingEpisodes,
                    updatedAt: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

            // Mark series as watched
            await supabase.from("user_watched").upsert(
                {
                    id: seriesWatchedId,
                    userId: user.uid,
                    mediaId: Number(mediaId),
                    mediaType: "tv",
                    title: seriesData.title || seriesData.name || "",
                    poster_path: seriesData.poster_path || "",
                    addedAt: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

            // Clear conflicting statuses
            await Promise.all([
                supabase.from("user_watchlist").delete().eq("id", seriesWatchedId),
                supabase.from("user_paused").delete().eq("id", seriesWatchedId),
                supabase.from("user_dropped").delete().eq("id", seriesWatchedId),
            ]);

            eventBus.emit("MEDIA_UPDATED", { mediaId, mediaType: "tv", action: "WATCHED", userId: user.uid });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });
            if (!options.silent) {
                const uname = user.username || user.uid;
                showToast.linked(`Marked ${seasonNumbers.length} season(s) as watched`, `/${uname}`);
            }
            return true;
        } catch (error) {
            console.error("[MediaService] markTVSeasonsWatchedBulk error:", error);
            showToast.error("Failed to mark seasons as watched");
            return false;
        }
    },

    async markTVSeasonWatched(user, mediaId, seriesData, seasonNumber, seasonEpisodeCounts = {}, options = {}) {
        return this.markTVSeasonsWatchedBulk(user, mediaId, seriesData, [seasonNumber], seasonEpisodeCounts, options);
    },

    async markTVEpisodeWatched(user, mediaId, seriesData, seasonNumber, episodeNumber, seasonEpisodeCounts = {}, options = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;
        const seriesWatchedId = getUniqueId(user.uid, "tv", mediaId);

        try {
            // Fetch existing progress
            const { data: existing } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .maybeSingle();

            const watchedEpisodes = existing?.watchedEpisodes && typeof existing.watchedEpisodes === "object"
                ? { ...existing.watchedEpisodes }
                : {};
            const seasonKey = String(seasonNumber);
            const currentEps = Array.isArray(watchedEpisodes[seasonKey]) ? [...watchedEpisodes[seasonKey]] : [];

            if (!currentEps.includes(episodeNumber)) {
                currentEps.push(episodeNumber);
                currentEps.sort((a, b) => a - b);
            }
            watchedEpisodes[seasonKey] = currentEps;

            // Check if entire season is now watched
            const watchedSeasons = Array.isArray(existing?.watchedSeasons) ? [...existing.watchedSeasons] : [];
            const totalEps = Number(seasonEpisodeCounts[seasonKey] || 0);
            if (totalEps > 0 && currentEps.length >= totalEps && !watchedSeasons.includes(seasonNumber)) {
                watchedSeasons.push(seasonNumber);
                watchedSeasons.sort((a, b) => a - b);
            }

            // Check if ALL seasons are now watched → auto-mark series as watched
            const totalSeasons = Object.keys(seasonEpisodeCounts).filter(
                (k) => Number(seasonEpisodeCounts[k]) > 0
            );
            let seriesNowFullyWatched = false;
            if (totalSeasons.length > 0 && watchedSeasons.length >= totalSeasons.length) {
                seriesNowFullyWatched = true;
                // Mark series as watched
                await supabase.from("user_watched").upsert(
                    {
                        id: seriesWatchedId,
                        userId: user.uid,
                        mediaId: Number(mediaId),
                        mediaType: "tv",
                        title: seriesData.title || seriesData.name || "",
                        poster_path: seriesData.poster_path || "",
                        addedAt: new Date().toISOString(),
                    },
                    { onConflict: "id" }
                );
                await Promise.all([
                    supabase.from("user_watchlist").delete().eq("id", seriesWatchedId),
                    supabase.from("user_paused").delete().eq("id", seriesWatchedId),
                    supabase.from("user_dropped").delete().eq("id", seriesWatchedId),
                ]);
            }

            // Upsert progress
            await supabase.from("user_series_progress").upsert(
                {
                    id: progressId,
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons,
                    watchedEpisodes,
                    updatedAt: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

            eventBus.emit("MEDIA_UPDATED", {
                mediaId,
                mediaType: "tv",
                action: "EPISODE_WATCHED",
                userId: user.uid,
                seriesFullyWatched: seriesNowFullyWatched,
            });
            eventBus.emit("PROFILE_DATA_INVALIDATED", { userId: user.uid });

            if (seriesNowFullyWatched) {
                showToast.success("All seasons watched! Series marked as watched.");
            } else {
                showToast.success(`S${seasonNumber}E${episodeNumber} marked as watched`);
            }
            return true;
        } catch (error) {
            console.error("[MediaService] markTVEpisodeWatched error:", error);
            showToast.error("Failed to mark episode as watched");
            return false;
        }
    },

    async unwatchTVSeason(user, mediaId, seasonNumber, seasonEpisodeCounts = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;

        try {
            const { data: existing } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .maybeSingle();

            if (!existing) return true;

            const watchedSeasons = Array.isArray(existing.watchedSeasons)
                ? existing.watchedSeasons.filter((n) => Number(n) !== Number(seasonNumber))
                : [];
            const watchedEpisodes = existing.watchedEpisodes && typeof existing.watchedEpisodes === "object"
                ? { ...existing.watchedEpisodes }
                : {};
            delete watchedEpisodes[String(seasonNumber)];

            await supabase.from("user_series_progress").upsert(
                {
                    id: progressId,
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons,
                    watchedEpisodes,
                    updatedAt: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

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

    async unwatchTVEpisode(user, mediaId, seasonNumber, episodeNumber, seasonEpisodeCounts = {}) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;

        try {
            const { data: existing } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .maybeSingle();

            if (!existing) return true;

            const watchedEpisodes = existing.watchedEpisodes && typeof existing.watchedEpisodes === "object"
                ? { ...existing.watchedEpisodes }
                : {};
            const seasonKey = String(seasonNumber);
            const currentEps = Array.isArray(watchedEpisodes[seasonKey])
                ? watchedEpisodes[seasonKey].filter((e) => Number(e) !== Number(episodeNumber))
                : [];

            if (currentEps.length > 0) {
                watchedEpisodes[seasonKey] = currentEps;
            } else {
                delete watchedEpisodes[seasonKey];
            }

            const watchedSeasons = Array.isArray(existing.watchedSeasons) ? [...existing.watchedSeasons] : [];

            await supabase.from("user_series_progress").upsert(
                {
                    id: progressId,
                    userId: user.uid,
                    seriesId: Number(mediaId),
                    watchedSeasons,
                    watchedEpisodes,
                    updatedAt: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

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

    async unwatchMovie(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const uniqueId = getUniqueId(user.uid, "movie", mediaId);
        try {
            await supabase.from("user_watched").delete().eq("id", uniqueId);
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

    async resetTVWatchProgress(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const progressId = `${user.uid}_${Number(mediaId)}`;
        const seriesWatchedId = getUniqueId(user.uid, "tv", mediaId);

        try {
            await Promise.all([
                supabase.from("user_series_progress").delete().eq("id", progressId),
                supabase.from("user_watched").delete().eq("id", seriesWatchedId),
            ]);

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

    // ── Currently Watching ──

    async isWatching(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const watchingId = `${user.uid}_watching_${Number(mediaId)}`;
        try {
            const { data } = await supabase
                .from("user_watching")
                .select("id")
                .eq("id", watchingId)
                .maybeSingle();
            return !!data;
        } catch {
            return false;
        }
    },

    async addToWatching(user, mediaId, mediaData) {
        if (!user?.uid || !mediaId) return false;
        const watchingId = `${user.uid}_watching_${Number(mediaId)}`;
        const tvBaseId = `${user.uid}_tv_${Number(mediaId)}`;

        try {
            await supabase.from("user_watching").upsert(
                {
                    id: watchingId,
                    userId: user.uid,
                    mediaId: Number(mediaId),
                    mediaType: "tv",
                    title: mediaData.title || mediaData.name || "",
                    poster_path: mediaData.poster_path || "",
                    addedAt: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

            // Clean up conflicting statuses
            await Promise.all([
                supabase.from("user_dropped").delete().eq("id", tvBaseId),
                supabase.from("user_paused").delete().eq("id", tvBaseId),
                supabase.from("user_watchlist").delete().eq("id", tvBaseId),
            ]);

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

    async removeFromWatching(user, mediaId) {
        if (!user?.uid || !mediaId) return false;
        const watchingId = `${user.uid}_watching_${Number(mediaId)}`;
        try {
            await supabase.from("user_watching").delete().eq("id", watchingId);
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

    // ── Propagation Helpers (called after rating a series/season) ──

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

            await this.markTVSeasonsWatchedBulk(user, mediaId, mediaData, seasonNumbers, seasonEpisodeCounts, { silent: true });
        } catch (error) {
            console.error("[MediaService] _propagateSeriesWatched error:", error);
        }
    },

    async _propagateSeasonWatched(user, mediaId, mediaData, seasonNumber, seasonEpisodeCounts) {
        if (!user?.uid || !mediaId || seasonNumber == null) return;
        try {
            let epCounts = seasonEpisodeCounts || {};
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
