"use client";

import { useEffect, useState, useRef, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Play, Sparkles, Tv, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { mediaService } from "@/services/mediaService";
import { getMediaUrl } from "@/lib/slugify";

/**
 * Weighted shuffle — prefers recent, high-rated, popular items
 */
function weightedShuffle(arr) {
    const weighted = arr.map((item, idx) => {
        const popularityWeight = Math.min((item.popularity || 0) / 100, 1);
        const ratingWeight = (item.vote_average || 0) / 10;
        const recencyWeight = 1 - idx / arr.length;
        const weight = popularityWeight * 0.4 + ratingWeight * 0.35 + recencyWeight * 0.25;
        return { item, weight: weight + Math.random() * 0.3 };
    });
    weighted.sort((a, b) => b.weight - a.weight);
    return weighted.map((w) => w.item);
}

/**
 * Session cache key
 */
const SESSION_CACHE_KEY = "vn_discovery_cache";

function getSessionCache() {
    if (typeof window === "undefined") return null;
    try {
        const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            // Invalidate if older than 30 min
            if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
                return parsed;
            }
        }
    } catch (_) {}
    return null;
}

function setSessionCache(data) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(
            SESSION_CACHE_KEY,
            JSON.stringify({ ...data, timestamp: Date.now() })
        );
    } catch (_) {}
}

function clearSessionCache() {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(SESSION_CACHE_KEY);
    } catch (_) {}
}

const MediaCard = memo(function MediaCard({ item, type }) {
    const href = getMediaUrl(item, type);
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").split("-")[0];
    const rating = item.vote_average?.toFixed(1);

    return (
        <Link href={href} className="group">
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow duration-300">
                <Image
                    src={tmdb.getImageUrl(item.poster_path)}
                    alt={title || "Poster"}
                    fill
                    className="object-cover"
                    loading="lazy"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />
            </div>
            <h3 className="text-base md:text-lg font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                {title}
            </h3>
            <div className="flex items-center gap-2 text-textSecondary text-sm">
                <span>{year}</span>
                <span>•</span>
                <span className="text-accent font-bold">★ {rating}</span>
            </div>
        </Link>
    );
});

export default function HomePage() {
    const [discoverMovies, setDiscoverMovies] = useState([]);
    const [discoverTV, setDiscoverTV] = useState([]);
    const [trendingMovies, setTrendingMovies] = useState([]);
    const [trendingTV, setTrendingTV] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const fetchedRef = useRef(false);

    useEffect(() => {
        // On each page load (including refresh), generate new content
        const fetchContent = async () => {
            // Check session cache — if same session, use cached data
            const cached = getSessionCache();
            if (cached && !fetchedRef.current) {
                setDiscoverMovies(cached.discoverMovies || []);
                setDiscoverTV(cached.discoverTV || []);
                setTrendingMovies(cached.trendingMovies || []);
                setTrendingTV(cached.trendingTV || []);
                setLoading(false);
                fetchedRef.current = true;
                return;
            }

            try {
                // Fetch from multiple sources — use Promise.allSettled so partial failures don't block
                const randomPage = Math.floor(Math.random() * 3) + 1;
                const results = await Promise.allSettled([
                    tmdb.getTrendingMovies("week"),
                    tmdb.getTrendingTV("week"),
                    fetchTMDBPage(`movie/popular?page=${randomPage}`),
                    fetchTMDBPage(`tv/popular?page=${randomPage}`),
                    fetchTMDBPage(`movie/top_rated?page=${randomPage}`),
                    fetchTMDBPage(`tv/top_rated?page=${randomPage}`),
                ]);

                const [
                    trendingMoviesData,
                    trendingTVData,
                    popularMovies,
                    popularTV,
                    topRatedMovies,
                    topRatedTV,
                ] = results.map(r => r.status === "fulfilled" ? r.value : []);

                // Get user's seen media IDs for filtering
                let seenIds = new Set();
                if (user) {
                    try {
                        seenIds = await mediaService.getUserSeenMediaIds(user.uid);
                    } catch {
                        // Non-blocking — display all content if this fails
                    }
                }

                // Merge and deduplicate movies
                const allMovies = deduplicateById([
                    ...(trendingMoviesData || []),
                    ...(popularMovies || []),
                    ...(topRatedMovies || []),
                ]);

                // Merge and deduplicate TV
                const allTV = deduplicateById([
                    ...(trendingTVData || []),
                    ...(popularTV || []),
                    ...(topRatedTV || []),
                ]);

                // Filter out seen content
                const unseenMovies = allMovies.filter((m) => !seenIds.has(m.id));
                const unseenTV = allTV.filter((t) => !seenIds.has(t.id));

                // Apply weighted shuffle
                const shuffledMovies = weightedShuffle(unseenMovies).slice(0, 10);
                const shuffledTV = weightedShuffle(unseenTV).slice(0, 10);

                // Trending stays as-is (but also filtered)
                const filteredTrendingMovies = (trendingMoviesData || [])
                    .filter((m) => !seenIds.has(m.id))
                    .slice(0, 10);
                const filteredTrendingTV = (trendingTVData || [])
                    .filter((t) => !seenIds.has(t.id))
                    .slice(0, 10);

                setDiscoverMovies(shuffledMovies);
                setDiscoverTV(shuffledTV);
                setTrendingMovies(filteredTrendingMovies);
                setTrendingTV(filteredTrendingTV);

                // Cache for this session
                setSessionCache({
                    discoverMovies: shuffledMovies,
                    discoverTV: shuffledTV,
                    trendingMovies: filteredTrendingMovies,
                    trendingTV: filteredTrendingTV,
                });
            } catch (error) {
                console.error("Error fetching content:", error);
                // Ensure homepage renders even on total failure — show empty state
            } finally {
                setLoading(false);
                fetchedRef.current = true;
            }
        };

        // Clear cache on actual page refresh (navigation reload)
        if (typeof window !== "undefined") {
            const navEntries = performance.getEntriesByType("navigation");
            if (navEntries.length > 0 && navEntries[0].type === "reload") {
                clearSessionCache();
                fetchedRef.current = false;
            }
        }

        fetchContent();
    }, [user]);

    // Stable spotlight — computed once from loaded data
    const featuredMovie = (() => {
        const candidates = [...discoverMovies, ...trendingMovies].filter(m => m.backdrop_path);
        if (candidates.length === 0) return null;
        // Use a stable index based on array length to avoid re-render flicker
        return candidates[candidates.length % Math.min(5, candidates.length)];
    })();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-textSecondary">Loading...</p>
                </div>
            </div>
        );
    }

    const hasContent = discoverMovies.length > 0 || trendingMovies.length > 0 || discoverTV.length > 0 || trendingTV.length > 0;

    return (
        <main className="min-h-screen bg-background">
            {/* Fallback empty state when API is down */}
            {!hasContent && (
                <section className="container py-24 text-center">
                    <Sparkles className="mx-auto text-accent mb-4" size={48} />
                    <h2 className="text-2xl font-bold mb-2">Content is loading...</h2>
                    <p className="text-textSecondary mb-6">We couldn&apos;t load content right now. Try refreshing the page.</p>
                    <button onClick={() => { clearSessionCache(); fetchedRef.current = false; window.location.reload(); }}
                        className="px-6 py-3 bg-accent text-background rounded-xl font-bold hover:bg-accent/90 transition">
                        Refresh
                    </button>
                </section>
            )}

            {/* Hero Section */}
            {featuredMovie && (
                <div className="relative w-full pt-16 min-h-[calc(100vh-4rem)]">
                    <div className="absolute inset-0 bg-black">
                        <div className="relative site-container h-full">
                            <Image
                                src={tmdb.getBannerUrl(featuredMovie.backdrop_path, null)}
                                alt={featuredMovie.title || featuredMovie.name || "Featured content"}
                                fill
                                className="object-contain object-right object-top"
                                priority
                                quality={90}
                            />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    </div>

                    <div className="relative site-container min-h-[calc(100vh-4rem)] flex items-end pb-12">
                        <div className="max-w-2xl">
                            <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
                                {featuredMovie.title || featuredMovie.name}
                            </h1>
                            <p className="text-lg md:text-xl text-textSecondary mb-8 line-clamp-3">
                                {featuredMovie.overview}
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link href={getMediaUrl(featuredMovie, featuredMovie.title ? "movie" : "tv")}>
                                    <Button size="lg">
                                        <Play className="mr-2 fill-current" size={20} />
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trending Movies */}
            {trendingMovies.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <TrendingUp className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Trending Movies</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {trendingMovies.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
                        ))}
                    </div>
                </section>
            )}

            {/* Discover Movies */}
            {discoverMovies.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Sparkles className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Discover Movies</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {discoverMovies.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
                        ))}
                    </div>
                </section>
            )}

            {/* Trending TV */}
            {trendingTV.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <TrendingUp className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Trending Shows</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {trendingTV.map((show) => (
                            <MediaCard key={show.id} item={show} type="tv" />
                        ))}
                    </div>
                </section>
            )}

            {/* Discover TV Shows */}
            {discoverTV.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Tv className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Discover Shows</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {discoverTV.map((show) => (
                            <MediaCard key={show.id} item={show} type="tv" />
                        ))}
                    </div>
                </section>
            )}

            {/* CTA Section - Only for non-logged-in users */}
            {!user && (
                <section className="site-container py-16">
                    <div className="bg-secondary rounded-2xl p-8 md:p-12 text-center border border-white/5">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Watch blind. Rate honestly.
                        </h2>
                        <p className="text-lg md:text-xl text-textSecondary mb-8 max-w-2xl mx-auto">
                            Track your movies and series without spoilers. Build your personal
                            journal and discover what&apos;s truly worth your time.
                        </p>
                        <Link href="/signup">
                            <Button size="lg">Get Started Free</Button>
                        </Link>
                    </div>
                </section>
            )}
        </main>
    );
}

/**
 * Helper: Fetch a TMDB page directly
 */
async function fetchTMDBPage(endpoint) {
    const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    try {
        const isBrowser = typeof window !== "undefined";
        const url = isBrowser
            ? `/api/tmdb?endpoint=${encodeURIComponent(endpoint)}`
            : `https://api.themoviedb.org/3/${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    } catch (error) {
        console.error("fetchTMDBPage error:", error);
        return [];
    }
}

/**
 * Helper: Deduplicate by ID
 */
function deduplicateById(items) {
    const seen = new Map();
    for (const item of items) {
        if (item.id && !seen.has(item.id)) {
            seen.set(item.id, item);
        }
    }
    return Array.from(seen.values());
}
