const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface Movie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    genre_ids?: number[];
}

export interface TVShow {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date: string;
    vote_average: number;
    genre_ids?: number[];
}

export interface Person {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department: string;
}

async function fetchTMDB(endpoint: string) {
    const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    return response.json();
}

export const tmdb = {
    // Get trending movies
    getTrendingMovies: async (timeWindow: "day" | "week" = "week") => {
        const data = await fetchTMDB(`/trending/movie/${timeWindow}`);
        return data.results as Movie[];
    },

    // Get trending TV shows
    getTrendingTV: async (timeWindow: "day" | "week" = "week") => {
        const data = await fetchTMDB(`/trending/tv/${timeWindow}`);
        return data.results as TVShow[];
    },

    // Search movies
    searchMovies: async (query: string) => {
        const data = await fetchTMDB(`/search/movie?query=${encodeURIComponent(query)}`);
        return data.results as Movie[];
    },

    // Search TV shows
    searchTV: async (query: string) => {
        const data = await fetchTMDB(`/search/tv?query=${encodeURIComponent(query)}`);
        return data.results as TVShow[];
    },

    // Get movie details
    getMovieDetails: async (id: number) => {
        return await fetchTMDB(`/movie/${id}?append_to_response=credits,videos`);
    },

    // Get TV show details
    getTVDetails: async (id: number) => {
        return await fetchTMDB(`/tv/${id}?append_to_response=credits,videos`);
    },

    // Get person details
    getPersonDetails: async (id: number) => {
        return await fetchTMDB(`/person/${id}?append_to_response=movie_credits,tv_credits`);
    },

    // Image helpers
    getImageUrl: (path: string | null, size: "w200" | "w500" | "original" = "w500") => {
        if (!path) return "/placeholder.png";
        return `${TMDB_IMAGE_BASE}/${size}${path}`;
    },
};
