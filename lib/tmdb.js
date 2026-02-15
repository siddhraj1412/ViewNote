import { tmdbCache } from "./cache";

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Fetch data from TMDB API with enhanced caching and stale-while-revalidate
 */
async function fetchTMDB(endpoint) {
    // Check cache first
    const cacheKey = endpoint;
    const cached = tmdbCache.get(cacheKey);

    if (cached) {
        // If stale, return cached data but revalidate in background
        if (cached.isStale) {
            // Return stale data immediately
            const staleData = cached.value;

            // Revalidate in background (don't await)
            revalidateInBackground(endpoint, cacheKey);

            return staleData;
        }
        // Fresh data
        return cached.value;
    }

    // No cache, fetch fresh data
    return await fetchFreshData(endpoint, cacheKey);
}

async function fetchFreshData(endpoint, cacheKey, retries = 2) {
    if (!TMDB_API_KEY) {
        console.error("TMDB API key is missing. Check NEXT_PUBLIC_TMDB_API_KEY env variable.");
        return { results: [] };
    }

    const url = `${TMDB_BASE_URL}/${endpoint}${endpoint.includes("?") ? "&" : "?"
        }api_key=${TMDB_API_KEY}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            // Cache the response
            tmdbCache.set(cacheKey, data);
            return data;
        } catch (error) {
            if (attempt < retries) {
                // Exponential backoff: 500ms, 1500ms
                await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
                continue;
            }
            console.error("TMDB fetch error:", error.message || error);
            throw error;
        }
    }
}

async function revalidateInBackground(endpoint, cacheKey) {
    try {
        await fetchFreshData(endpoint, cacheKey);
    } catch (error) {
        // Silent fail - we already returned stale data
        console.warn("Background revalidation failed:", error);
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

    getTVSeasonDetails: async (tvId, seasonNumber) => {
        try {
            return await fetchTMDB(
                `tv/${tvId}/season/${seasonNumber}?append_to_response=credits,images,videos`
            );
        } catch (error) {
            console.error("Error fetching TV season details:", error);
            return null;
        }
    },

    getTVEpisodeDetails: async (tvId, seasonNumber, episodeNumber) => {
        try {
            return await fetchTMDB(
                `tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?append_to_response=credits,images,videos`
            );
        } catch (error) {
            console.error("Error fetching TV episode details:", error);
            return null;
        }
    },

    getTVDetails: async (id) => {
        // Fetch TV details with regular credits
        const data = await fetchTMDB(
            `tv/${id}?append_to_response=credits,similar,videos`
        );

        // Fetch aggregate credits for complete cast (all seasons/episodes)
        try {
            const aggregateCredits = await fetchTMDB(`tv/${id}/aggregate_credits`);

            // Merge aggregate cast with regular cast, prioritizing aggregate
            if (aggregateCredits?.cast) {
                // Remove duplicates and normalize
                const castMap = new Map();

                // Add aggregate cast first (priority)
                aggregateCredits.cast.forEach(person => {
                    if (person.id && !castMap.has(person.id)) {
                        castMap.set(person.id, {
                            ...person,
                            character: person.roles?.[0]?.character || person.character,
                            episode_count: person.roles?.reduce((sum, role) => sum + (role.episode_count || 0), 0) || 0
                        });
                    }
                });

                // Add regular cast as fallback
                if (data.credits?.cast) {
                    data.credits.cast.forEach(person => {
                        if (person.id && !castMap.has(person.id)) {
                            castMap.set(person.id, person);
                        }
                    });
                }

                // Convert back to array and sort by episode count
                data.credits = data.credits || {};
                data.credits.cast = Array.from(castMap.values())
                    .filter(person => person.profile_path) // Remove null profiles
                    .sort((a, b) => (b.episode_count || 0) - (a.episode_count || 0));
            }

            // Merge aggregate crew
            if (aggregateCredits?.crew) {
                const crewMap = new Map();

                aggregateCredits.crew.forEach(person => {
                    if (person.id && !crewMap.has(person.id)) {
                        crewMap.set(person.id, {
                            ...person,
                            job: person.jobs?.[0]?.job || person.job,
                            department: person.department
                        });
                    }
                });

                if (data.credits?.crew) {
                    data.credits.crew.forEach(person => {
                        if (person.id && !crewMap.has(person.id)) {
                            crewMap.set(person.id, person);
                        }
                    });
                }

                data.credits.crew = Array.from(crewMap.values());
            }
        } catch (error) {
            console.error("Error fetching aggregate credits:", error);
            // Continue with regular credits if aggregate fails
        }

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

    /**
     * Get strongly related content using multi-factor similarity scoring
     * @param {number} id - Movie or TV show ID
     * @param {string} type - 'movie' or 'tv'
     * @param {object} currentItem - Current movie/TV details with credits
     * @returns {Promise<Array>} - Array of strongly related items
     */
    getStronglyRelated: async (id, type, currentItem) => {
        try {
            // Fetch potential candidates from multiple sources
            const [similar, recommendations, byGenre] = await Promise.all([
                fetchTMDB(`${type}/${id}/similar`),
                fetchTMDB(`${type}/${id}/recommendations`),
                currentItem.genres && currentItem.genres.length > 0
                    ? fetchTMDB(
                        `discover/${type}?with_genres=${currentItem.genres
                            .map((g) => g.id)
                            .join(",")}&sort_by=popularity.desc`
                    )
                    : Promise.resolve({ results: [] }),
            ]);

            // Combine all candidates
            const allCandidates = [
                ...similar.results,
                ...recommendations.results,
                ...byGenre.results,
            ];

            // Remove duplicates and current item
            const uniqueCandidates = Array.from(
                new Map(allCandidates.map((item) => [item.id, item])).values()
            ).filter((item) => item.id !== id);

            // Score each candidate
            const scoredItems = await Promise.all(
                uniqueCandidates.slice(0, 30).map(async (candidate) => {
                    const score = await tmdb.calculateSimilarityScore(
                        currentItem,
                        candidate,
                        type
                    );
                    return { ...candidate, similarityScore: score };
                })
            );

            // Filter by threshold and sort by score
            const threshold = 40;
            const stronglyRelated = scoredItems
                .filter((item) => item.similarityScore >= threshold)
                .sort((a, b) => b.similarityScore - a.similarityScore)
                .slice(0, 10);

            // Fallback: if too few results, include top-scored candidates regardless of threshold
            if (stronglyRelated.length < 4 && scoredItems.length > 0) {
                const topScored = scoredItems
                    .sort((a, b) => b.similarityScore - a.similarityScore)
                    .slice(0, 10);
                return topScored;
            }

            return stronglyRelated;
        } catch (error) {
            console.error("Error getting strongly related content:", error);
            return [];
        }
    },

    /**
     * Calculate similarity score between two items
     * @param {object} current - Current item with full details
     * @param {object} candidate - Candidate item (basic details)
     * @param {string} type - 'movie' or 'tv'
     * @returns {Promise<number>} - Similarity score (0-100)
     */
    calculateSimilarityScore: async (current, candidate, type) => {
        let score = 0;

        // Fetch full details for candidate if needed
        let candidateDetails = candidate;
        if (!candidate.credits) {
            try {
                candidateDetails = await fetchTMDB(
                    `${type}/${candidate.id}?append_to_response=credits,keywords`
                );
            } catch (error) {
                candidateDetails = candidate;
            }
        }

        // 1. Genre Overlap (40% weight)
        if (current.genres && candidateDetails.genres) {
            const currentGenreIds = current.genres.map((g) => g.id);
            const candidateGenreIds = candidateDetails.genres.map((g) => g.id);
            const overlap = currentGenreIds.filter((id) =>
                candidateGenreIds.includes(id)
            ).length;
            const maxGenres = Math.max(
                currentGenreIds.length,
                candidateGenreIds.length
            );
            if (maxGenres > 0) {
                score += (overlap / maxGenres) * 40;
            }
        }

        // 2. Director Match (20% weight) - Movies only
        if (type === "movie" && current.credits && candidateDetails.credits) {
            const currentDirectors =
                current.credits.crew
                    ?.filter((c) => c.job === "Director")
                    .map((c) => c.id) || [];
            const candidateDirectors =
                candidateDetails.credits.crew
                    ?.filter((c) => c.job === "Director")
                    .map((c) => c.id) || [];

            const directorMatch = currentDirectors.some((id) =>
                candidateDirectors.includes(id)
            );
            if (directorMatch) {
                score += 20;
            }
        }

        // 3. Cast Overlap (20% weight)
        if (current.credits && candidateDetails.credits) {
            const currentCast =
                current.credits.cast?.slice(0, 10).map((c) => c.id) || [];
            const candidateCast =
                candidateDetails.credits.cast?.slice(0, 10).map((c) => c.id) ||
                [];

            const castOverlap = currentCast.filter((id) =>
                candidateCast.includes(id)
            ).length;
            if (currentCast.length > 0) {
                score += (castOverlap / currentCast.length) * 20;
            }
        }

        // 4. Rating Proximity (5% weight)
        if (current.vote_average && candidateDetails.vote_average) {
            const ratingDiff = Math.abs(
                current.vote_average - candidateDetails.vote_average
            );
            const ratingScore = Math.max(0, (10 - ratingDiff) / 10);
            score += ratingScore * 5;
        }

        // 5. Year Proximity (5% weight)
        const currentYear = current.release_date
            ? new Date(current.release_date).getFullYear()
            : current.first_air_date
                ? new Date(current.first_air_date).getFullYear()
                : null;
        const candidateYear = candidateDetails.release_date
            ? new Date(candidateDetails.release_date).getFullYear()
            : candidateDetails.first_air_date
                ? new Date(candidateDetails.first_air_date).getFullYear()
                : null;

        if (currentYear && candidateYear) {
            const yearDiff = Math.abs(currentYear - candidateYear);
            const yearScore = Math.max(0, (20 - yearDiff) / 20);
            score += yearScore * 5;
        }

        // 6. Keyword Similarity (10% weight) - if available
        if (current.keywords && candidateDetails.keywords) {
            const currentKeywords =
                current.keywords.keywords?.map((k) => k.id) ||
                current.keywords.results?.map((k) => k.id) ||
                [];
            const candidateKeywords =
                candidateDetails.keywords.keywords?.map((k) => k.id) ||
                candidateDetails.keywords.results?.map((k) => k.id) ||
                [];

            if (currentKeywords.length > 0 && candidateKeywords.length > 0) {
                const keywordOverlap = currentKeywords.filter((id) =>
                    candidateKeywords.includes(id)
                ).length;
                const maxKeywords = Math.max(
                    currentKeywords.length,
                    candidateKeywords.length
                );
                score += (keywordOverlap / maxKeywords) * 10;
            }
        }

        return Math.round(score);
    },

    /**
     * Get production company details
     */
    getProductionCompanyDetails: async (companyId) => {
        try {
            const data = await fetchTMDB(`company/${companyId}`);
            return data;
        } catch (error) {
            console.error("Error fetching production company:", error);
            return null;
        }
    },

    /**
     * Get movies by production company
     */
    getProductionCompanyMovies: async (companyId) => {
        try {
            const data = await fetchTMDB(`discover/movie?with_companies=${companyId}&sort_by=popularity.desc`);
            return data.results || [];
        } catch (error) {
            console.error("Error fetching company movies:", error);
            return [];
        }
    },

    /**
     * Get TV shows by production company
     */
    getProductionCompanyTV: async (companyId) => {
        try {
            const data = await fetchTMDB(`discover/tv?with_companies=${companyId}&sort_by=popularity.desc`);
            return data.results || [];
        } catch (error) {
            console.error("Error fetching company TV shows:", error);
            return [];
        }
    },

    /**
     * Get movie images
     */
    getMovieImages: async (id) => {
        try {
            const data = await fetchTMDB(`movie/${id}/images`);
            return data;
        } catch (error) {
            console.error("Error fetching movie images:", error);
            return { backdrops: [], posters: [] };
        }
    },

    /**
     * Get TV images
     */
    getTVImages: async (id) => {
        try {
            const data = await fetchTMDB(`tv/${id}/images`);
            return data;
        } catch (error) {
            console.error("Error fetching TV images:", error);
            return { backdrops: [], posters: [] };
        }
    },
};
