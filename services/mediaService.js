import { tmdb } from "@/lib/tmdb";

/**
 * Media Service Layer
 * Centralizes TMDB API calls for movies and TV shows
 */

export const mediaService = {
    /**
     * Get movie or TV details
     */
    async getDetails(mediaId, mediaType) {
        try {
            if (mediaType === "movie") {
                return await tmdb.getMovieDetails(mediaId);
            } else if (mediaType === "tv") {
                return await tmdb.getTVDetails(mediaId);
            }
            throw new Error("Invalid media type");
        } catch (error) {
            console.error("Error fetching details:", error);
            return null;
        }
    },

    /**
     * Get images for movie or TV
     */
    async getImages(mediaId, mediaType) {
        try {
            if (mediaType === "movie") {
                return await tmdb.getMovieImages(mediaId);
            } else if (mediaType === "tv") {
                return await tmdb.getTVImages(mediaId);
            }
            throw new Error("Invalid media type");
        } catch (error) {
            console.error("Error fetching images:", error);
            return { backdrops: [], posters: [] };
        }
    },

    /**
     * Get high-resolution backdrops
     */
    async getBackdrops(mediaId, mediaType) {
        try {
            const images = await this.getImages(mediaId, mediaType);
            const backdrops = images?.backdrops || [];

            // Filter high resolution and sort by vote — no limit
            return backdrops
                .filter((b) => b.width >= 1280)
                .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } catch (error) {
            console.error("Error fetching backdrops:", error);
            return [];
        }
    },
};
