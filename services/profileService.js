import supabase from "@/lib/supabase";

/**
 * Profile Service
 * Fetches user profile data with customization joins
 */

export const profileService = {

    async getCustomizationsMap(userId) {
        if (!userId) return {};
        try {
            const { data, error } = await supabase
                .from("user_media_preferences")
                .select('mediaType, mediaId, customPoster, customBanner')
                .eq("userId", userId);

            if (error) {
                console.error("Error fetching customizations:", error);
                return {};
            }

            const map = {};
            (data || []).forEach(row => {
                map[`${row.mediaType}_${row.mediaId}`] = {
                    customPoster: row.customPoster,
                    customBanner: row.customBanner,
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
        if (!userId) return { movies: [], shows: [], episodes: [] };
        try {
            const [favsResult, customizationsMap] = await Promise.all([
                supabase
                    .from("favorites")
                    .select('*')
                    .eq("userId", userId),
                this.getCustomizationsMap(userId),
            ]);

            const allFavs = favsResult.data || [];

            const movies = allFavs
                .filter(f => f.category === 'movies')
                .map(f => ({ id: f.id, ...f, mediaType: "movie" }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            const shows = allFavs
                .filter(f => f.category === 'shows')
                .map(f => ({ id: f.id, ...f, mediaType: "tv" }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            const episodes = allFavs
                .filter(f => f.category === 'episodes')
                .map(f => ({ id: f.id, ...f, mediaType: "episode" }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            return {
                movies: this.applyCustomizations(movies, customizationsMap),
                shows: this.applyCustomizations(shows, customizationsMap),
                episodes,
            };
        } catch (error) {
            console.error("Error fetching favorites:", error);
            return { movies: [], shows: [], episodes: [] };
        }
    },

    async getWatched(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        try {
            const { data, error } = await supabase
                .from("user_watched")
                .select('*')
                .eq("userId", userId)
                .order("addedAt", { ascending: false });

            if (error) {
                console.error("[ProfileService] Error in user_watched:", error);
                return [];
            }

            const items = (data || []).map(row => ({ id: row.id, ...row }));
            return this.applyCustomizations(items, customizationsMap);
        } catch (error) {
            console.error("[ProfileService] Error in user_watched:", error);
            return [];
        }
    },

    async getWatching(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        try {
            const { data, error } = await supabase
                .from("user_watching")
                .select('*')
                .eq("userId", userId)
                .order("startedAt", { ascending: false });

            if (error) {
                // Fallback without ordering
                const { data: fallbackData } = await supabase
                    .from("user_watching")
                    .select('*')
                    .eq("userId", userId);

                const items = (fallbackData || [])
                    .map(row => ({ id: row.id, ...row }))
                    .sort((a, b) => {
                        const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
                        const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
                        return bTime - aTime;
                    });

                const normalized = items.map((i) => ({ ...i, mediaType: i.mediaType || "tv", mediaId: i.seriesId ?? i.mediaId }));
                return this.applyCustomizations(normalized, customizationsMap);
            }

            const items = (data || []).map(row => ({ id: row.id, ...row }));
            const normalized = items.map((i) => ({ ...i, mediaType: i.mediaType || "tv", mediaId: i.seriesId ?? i.mediaId }));
            return this.applyCustomizations(normalized, customizationsMap);
        } catch (error) {
            console.error("[ProfileService] Error in user_watching:", error);
            return [];
        }
    },

    async getWatchlist(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        try {
            const { data, error } = await supabase
                .from("user_watchlist")
                .select('*')
                .eq("userId", userId)
                .order("addedAt", { ascending: false });

            if (error) {
                console.error("[ProfileService] Error in user_watchlist:", error);
                return [];
            }

            const items = (data || []).map(row => ({ id: row.id, ...row }));
            return this.applyCustomizations(items, customizationsMap);
        } catch (error) {
            console.error("[ProfileService] Error in user_watchlist:", error);
            return [];
        }
    },

    async getRatings(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select('*')
                .eq("userId", userId)
                .order("createdAt", { ascending: false });

            if (error) {
                // Fallback: try without ordering
                const { data: fallbackData } = await supabase
                    .from("user_ratings")
                    .select('*')
                    .eq("userId", userId);

                const items = (fallbackData || [])
                    .map(row => ({ id: row.id, ...row }))
                    .sort((a, b) => {
                        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : (a.ratedAt ? new Date(a.ratedAt).getTime() : 0);
                        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : (b.ratedAt ? new Date(b.ratedAt).getTime() : 0);
                        return bTime - aTime;
                    });

                return this.applyCustomizations(items, customizationsMap);
            }

            const items = (data || []).map(row => ({ id: row.id, ...row }));
            return this.applyCustomizations(items, customizationsMap);
        } catch (error) {
            console.error("[ProfileService] Error in user_ratings:", error);
            return [];
        }
    },

    async getPaused(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        try {
            const { data, error } = await supabase
                .from("user_paused")
                .select('*')
                .eq("userId", userId)
                .order("pausedAt", { ascending: false });

            if (error) {
                console.error("[ProfileService] Error in user_paused:", error);
                return [];
            }

            const items = (data || []).map(row => ({ id: row.id, ...row }));
            return this.applyCustomizations(items, customizationsMap);
        } catch (error) {
            console.error("[ProfileService] Error in user_paused:", error);
            return [];
        }
    },

    async getDropped(userId) {
        if (!userId) return [];
        const customizationsMap = await this.getCustomizationsMap(userId);

        try {
            const { data, error } = await supabase
                .from("user_dropped")
                .select('*')
                .eq("userId", userId)
                .order("droppedAt", { ascending: false });

            if (error) {
                console.error("[ProfileService] Error in user_dropped:", error);
                return [];
            }

            const items = (data || []).map(row => ({ id: row.id, ...row }));
            return this.applyCustomizations(items, customizationsMap);
        } catch (error) {
            console.error("[ProfileService] Error in user_dropped:", error);
            return [];
        }
    },
};
