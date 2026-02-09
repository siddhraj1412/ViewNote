const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function fetchTMDB(endpoint) {
    const url = `${TMDB_BASE_URL}/${endpoint}${endpoint.includes("?") ? "&" : "?"
        }api_key=${TMDB_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TMDB API Error: ${response.statusText}`);
    }
    return response.json();
}

export const tmdb = {
    getImageUrl: (path, size = "w500") => {
        if (!path) return "/placeholder.svg";
        return `https://image.tmdb.org/t/p/${size}${path}`;
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
        const data = await fetchTMDB(`search/movie?query=${encodeURIComponent(query)}`);
        return data.results;
    },

    searchTV: async (query) => {
        const data = await fetchTMDB(`search/tv?query=${encodeURIComponent(query)}`);
        return data.results;
    },

    getMovieDetails: async (id) => {
        const data = await fetchTMDB(`movie/${id}?append_to_response=credits,similar,videos`);
        return data;
    },

    getTVDetails: async (id) => {
        const data = await fetchTMDB(`tv/${id}?append_to_response=credits,similar,videos`);
        return data;
    },

    getPersonDetails: async (id) => {
        const data = await fetchTMDB(`person/${id}?append_to_response=combined_credits`);
        return data;
    }
};
