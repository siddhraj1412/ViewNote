import { tmdbCache } from "./cache";

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Fetch data from TMDB API with caching and error handling
 */
async function fetchTMDB(endpoint) {
    // Check cache first
    const cacheKey = endpoint;
    const cached = tmdbCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const url = `${TMDB_BASE_URL}/${endpoint}${endpoint.includes("?") ? "&" : "?"
        }api_key=${TMDB_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.statusText}`);
        }
        const data = await response.json();

        // Cache the response
        tmdbCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error("TMDB fetch error:", error);
        throw error;
    }
}

export const tmdb = {
    /**
     * Get image URL with fallback for missing posters
     * @param {string} path - TMDB image path
     * @param {string} size - Image size (w500, original, etc.)
     * @param {string} type - Image type: 'poster', 'backdrop', 'profile'
     * @returns {string} Image URL or fallback
     */
    getImageUrl: (path, size = "w500", type = "poster") => {
        if (!path) {
            // Return appropriate placeholder based on type
            if (type === "backdrop" || type === "banner") {
                return "/placeholder-banner.svg";
            } else if (type === "profile" || type === "avatar") {
                return "/default-avatar.svg";
            }
            return "/placeholder-poster.svg";
        }
        return `https://image.tmdb.org/t/p/${size}${path}`;
    },

    /**
     * Get backdrop/banner URL with fallback hierarchy:
     * 1. TMDB backdrop
     * 2. Custom user banner (if provided)
     * 3. TMDB poster as banner
     * 4. Neutral gradient placeholder
     */
    getBannerUrl: (backdropPath, posterPath, customBannerUrl = null) => {
        if (backdropPath) {
            return `https://image.tmdb.org/t/p/original${backdropPath}`;
        }
        if (customBannerUrl) {
            return customBannerUrl;
        }
        if (posterPath) {
            return `https://image.tmdb.org/t/p/original${posterPath}`;
        }
        return "/placeholder-banner.svg";
    },

    getTrendingMovies: async (timeWindow = "week") => {
        const data = await fetchTMDB(`trending/movie/${timeWindow}`);
        return data.results;
    },

    getTrendingTV: async (timeWindow = "week") => {
        const data = await fetchTMDB(`trending/tv/${timeWindow}`);
        return data.results;
    },

    searchMovies: async (query) => {
        const data = await fetchTMDB(
            `search/movie?query=${encodeURIComponent(query)}`
        );
        return data.results;
    },

    searchTV: async (query) => {
        const data = await fetchTMDB(`search/tv?query=${encodeURIComponent(query)}`);
        return data.results;
    },

    getMovieDetails: async (id) => {
        const data = await fetchTMDB(
            `movie/${id}?append_to_response=credits,similar,videos`
        );
        return data;
    },

    getTVDetails: async (id) => {
        const data = await fetchTMDB(
            `tv/${id}?append_to_response=credits,similar,videos`
        );
        return data;
    },

    getPersonDetails: async (id) => {
        return fetchTMDB(`person/${id}`);
    },

    getPersonCredits: async (id) => {
        return fetchTMDB(`person/${id}/combined_credits`);
    },

    searchMulti: async (query) => {
        return fetchTMDB(`search/multi?query=${encodeURIComponent(query)}`);
    },
};
