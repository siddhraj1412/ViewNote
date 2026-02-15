"use client";

import { useEffect, useState, useRef, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Play, Sparkles, Tv, TrendingUp, Calendar, Clapperboard, Flame, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { mediaService } from "@/services/mediaService";
import { getMediaUrl } from "@/lib/slugify";

/**
 * Session cache key
 */
const SESSION_CACHE_KEY = "vn_discovery_cache";
const ROTATION_KEY = "vn_shown_ids";

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

/** Rotation pool: track shown IDs in localStorage so refreshes show fresh content */
function getShownIds() {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = localStorage.getItem(ROTATION_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.ids) && Date.now() - (parsed.ts || 0) < 24 * 60 * 60 * 1000) {
                return new Set(parsed.ids);
            }
        }
    } catch (_) {}
    return new Set();
}

function saveShownIds(ids) {
    if (typeof window === "undefined") return;
    try {
        const arr = [...ids].slice(-500); // keep last 500
        localStorage.setItem(ROTATION_KEY, JSON.stringify({ ids: arr, ts: Date.now() }));
    } catch (_) {}
}

function randomPage(max = 5) {
    return Math.floor(Math.random() * max) + 1;
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
    const emptySections = {
        trendingMovies: [],
        trendingTV: [],
        newEpisodes: [],
        inTheatres: [],
        popularMovies: [],
        comingSoon: [],
        mostAnticipated: [],
    };

    // Detect hard refresh before state init so we never serve stale cache on reload
    const isHardRefresh = useRef(false);
    if (typeof window !== "undefined") {
        try {
            const navEntries = performance.getEntriesByType("navigation");
            if (navEntries.length > 0 && navEntries[0].type === "reload") {
                clearSessionCache();
                isHardRefresh.current = true;
            }
        } catch (_) {}
    }

    const [sections, setSections] = useState(() => {
        if (typeof window !== "undefined" && !isHardRefresh.current) {
            const cached = getSessionCache();
            if (cached?.sections) return cached.sections;
        }
        return emptySections;
    });
    const [heroCategory, setHeroCategory] = useState(() => {
        if (typeof window !== "undefined" && !isHardRefresh.current) {
            const cached = getSessionCache();
            if (cached?.heroCategory) return cached.heroCategory;
        }
        return "trending";
    });
    const [loading, setLoading] = useState(() => {
        if (typeof window !== "undefined" && !isHardRefresh.current) {
            return !getSessionCache();
        }
        return true;
    });
    const { user, loading: authLoading } = useAuth();
    const fetchedRef = useRef(false);

    useEffect(() => {
        // Wait for auth to settle before fetching — prevents double fetch
        if (authLoading) return;

        // Already fetched this mount (e.g. from cache path) — skip
        if (fetchedRef.current) return;

        const controller = new AbortController();

        const fetchContent = async () => {
            // Check cache first (soft navigations)
            const cached = getSessionCache();
            if (cached) {
                setSections(cached.sections || emptySections);
                setHeroCategory(cached.heroCategory || "trending");
                setLoading(false);
                fetchedRef.current = true;
                return;
            }

            setLoading(true);
            try {
                const today = new Date();
                const futureDate = new Date(today);
                futureDate.setMonth(futureDate.getMonth() + 2);
                const futureDateStr = futureDate.toISOString().split("T")[0];
                const todayStr = today.toISOString().split("T")[0];

                const pg = randomPage;
                const results = await Promise.allSettled([
                    tmdb.getTrendingMovies("week"),
                    tmdb.getTrendingTV("week"),
                    fetchTMDBPage(`tv/on_the_air?page=${pg(3)}`),
                    fetchTMDBPage(`movie/now_playing?page=${pg(3)}`),
                    fetchTMDBPage(`movie/popular?page=${pg(5)}`),
                    fetchTMDBPage(`movie/upcoming?page=${pg(3)}`),
                    fetchTMDBPage(`discover/movie?primary_release_date.gte=${todayStr}&primary_release_date.lte=${futureDateStr}&sort_by=popularity.desc&page=${pg(3)}`),
                ]);

                if (controller.signal.aborted) return;

                const extract = (i) => (results[i].status === "fulfilled" ? results[i].value : []);

                let seenIds = new Set();
                if (user) {
                    try { seenIds = await mediaService.getUserSeenMediaIds(user.uid); } catch {}
                }

                const shownIds = getShownIds();
                const filterSeen = (arr) => arr.filter((m) => !seenIds.has(m.id));
                const filterShown = (arr) => {
                    const fresh = arr.filter((m) => !shownIds.has(m.id));
                    return fresh.length >= 5 ? fresh : arr;
                };
                const pickSection = (arr) => filterShown(filterSeen(arr)).slice(0, 10);

                const newSections = {
                    trendingMovies: pickSection(extract(0)),
                    trendingTV: pickSection(extract(1)),
                    newEpisodes: pickSection(extract(2)),
                    inTheatres: pickSection(extract(3)),
                    popularMovies: pickSection(extract(4)),
                    comingSoon: pickSection(extract(5)),
                    mostAnticipated: pickSection(extract(6)),
                };

                const allNewIds = new Set(shownIds);
                Object.values(newSections).forEach((arr) => arr.forEach((m) => allNewIds.add(m.id)));
                saveShownIds(allNewIds);

                const categories = ["trending", "popular", "top_rated"];
                const cat = categories[Math.floor(Math.random() * categories.length)];

                if (!controller.signal.aborted) {
                    setSections(newSections);
                    setHeroCategory(cat);
                    setSessionCache({ sections: newSections, heroCategory: cat });
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error("Error fetching content:", error);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    fetchedRef.current = true;
                }
            }
        };

        fetchContent();
        return () => controller.abort();
    }, [user, authLoading]);

    // Stable spotlight — picks from trending or popular pool
    const featuredMovie = (() => {
        let pool;
        if (heroCategory === "top_rated") {
            pool = [...sections.popularMovies].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else if (heroCategory === "popular") {
            pool = [...sections.popularMovies].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        } else {
            pool = [...sections.trendingMovies, ...sections.popularMovies];
        }
        const candidates = pool.filter(m => m.backdrop_path);
        if (candidates.length === 0) return null;
        return candidates[candidates.length % Math.min(5, candidates.length)];
    })();

    const heroCategoryLabel = heroCategory === "top_rated" ? "Top Rated" : heroCategory === "popular" ? "Popular Now" : "Trending";

    if (loading) {
        return (
            <main className="min-h-screen bg-background">
                {/* Skeleton hero */}
                <div className="relative w-full pt-16 min-h-[60vh]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent animate-pulse" />
                    <div className="relative site-container flex items-end pb-12 min-h-[60vh]">
                        <div className="max-w-2xl space-y-4 w-full">
                            <div className="h-5 w-24 bg-white/10 rounded-full" />
                            <div className="h-12 w-3/4 bg-white/10 rounded-xl" />
                            <div className="h-4 w-full bg-white/10 rounded" />
                            <div className="h-4 w-2/3 bg-white/10 rounded" />
                            <div className="h-12 w-36 bg-white/10 rounded-xl" />
                        </div>
                    </div>
                </div>
                {/* Skeleton grid sections */}
                {[0, 1].map((i) => (
                    <section key={i} className="site-container py-16">
                        <div className="h-8 w-64 bg-white/10 rounded-xl mb-8" />
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                            {Array.from({ length: 5 }).map((_, j) => (
                                <div key={j} className="space-y-4">
                                    <div className="aspect-[2/3] rounded-2xl bg-white/5 animate-pulse" />
                                    <div className="h-4 w-3/4 bg-white/10 rounded" />
                                    <div className="h-3 w-1/2 bg-white/10 rounded" />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </main>
        );
    }

    const hasContent = Object.values(sections).some((arr) => arr.length > 0);

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
                                placeholder="blur"
                                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxMTExMTEiLz48L3N2Zz4="
                                sizes="100vw"
                            />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    </div>

                    <div className="relative site-container min-h-[calc(100vh-4rem)] flex items-end pb-12">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 bg-accent/20 backdrop-blur-sm rounded-full text-accent text-sm font-semibold">
                                <Sparkles size={14} />
                                {heroCategoryLabel}
                            </div>
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

            {/* 1. Trending This Week */}
            {sections.trendingMovies.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <TrendingUp className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Trending This Week</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.trendingMovies.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
                        ))}
                    </div>
                </section>
            )}

            {/* 2. New Episodes */}
            {sections.newEpisodes.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Tv className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">New Episodes</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.newEpisodes.map((show) => (
                            <MediaCard key={show.id} item={show} type="tv" />
                        ))}
                    </div>
                </section>
            )}

            {/* 3. In Theatres Now */}
            {sections.inTheatres.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Clapperboard className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">In Theatres Now</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.inTheatres.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
                        ))}
                    </div>
                </section>
            )}

            {/* 4. Popular Movies */}
            {sections.popularMovies.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Flame className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Popular Movies</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.popularMovies.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
                        ))}
                    </div>
                </section>
            )}

            {/* 5. Trending Shows */}
            {sections.trendingTV.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <TrendingUp className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Trending Shows</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.trendingTV.map((show) => (
                            <MediaCard key={show.id} item={show} type="tv" />
                        ))}
                    </div>
                </section>
            )}

            {/* 6. Coming Soon */}
            {sections.comingSoon.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Calendar className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Coming Soon</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.comingSoon.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
                        ))}
                    </div>
                </section>
            )}

            {/* 7. Most Anticipated */}
            {sections.mostAnticipated.length > 0 && (
                <section className="site-container py-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Clock className="text-accent" size={32} />
                        <h2 className="text-3xl md:text-4xl font-bold">Most Anticipated</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                        {sections.mostAnticipated.map((movie) => (
                            <MediaCard key={movie.id} item={movie} type="movie" />
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
        const url = `https://api.themoviedb.org/3/${endpoint}${
            endpoint.includes("?") ? "&" : "?"
        }api_key=${TMDB_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    } catch (error) {
        console.error("fetchTMDBPage error:", error);
        return [];
    }
}
