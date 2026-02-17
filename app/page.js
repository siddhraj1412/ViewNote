"use client";

import { useEffect, useState, useRef, memo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Play, Sparkles, Tv, TrendingUp, Calendar, Clapperboard, Flame, Eye, Gem } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { mediaService } from "@/services/mediaService";
import { getMediaUrl } from "@/lib/slugify";
import {
    getSessionCache,
    setSessionCache,
    clearSessionCache,
    getRotationPool,
    saveRotationPool,
    recordShownIds,
    dedupPick,
    saveFallbackData,
    getFallbackData,
    isCircuitOpen,
    recordSuccess,
    recordFailure,
    invalidateRecommendationCache,
} from "@/lib/recommendationCache";
import eventBus from "@/lib/eventBus";

// ═══════════════════════════════════════════════════════════════════
// Per-section TTL caching (localStorage)
// Ensures sections do NOT change on refresh — only on TTL expiry.
// ═══════════════════════════════════════════════════════════════════

const SECTION_TTLS = {
    whatsHot: 12 * 60 * 60 * 1000,       // 12 hours — fresh trending
    freshEpisodes: 6 * 60 * 60 * 1000,   // 6 hours — new episodes
    inCinemas: 24 * 60 * 60 * 1000,      // 24 hours — daily
    popular: 24 * 60 * 60 * 1000,        // 24 hours — daily
    bingeWorthy: 3 * 24 * 60 * 60 * 1000, // 3 days — curated feel
    comingSoon: 24 * 60 * 60 * 1000,     // 24 hours — daily
    hiddenGems: 7 * 24 * 60 * 60 * 1000, // 7 days — rotate slowly
    heroPool: 24 * 60 * 60 * 1000,       // 24 hours — pool refreshes daily, pick changes per visit
};

function getSectionCache(key) {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(`vn_sec_${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts < (SECTION_TTLS[key] || 24 * 60 * 60 * 1000)) {
            return parsed.data;
        }
    } catch {}
    return null;
}

function setSectionCache(key, data) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(`vn_sec_${key}`, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// MediaCard
// ═══════════════════════════════════════════════════════════════════

const MediaCard = memo(function MediaCard({ item, type }) {
    const href = getMediaUrl(item, type);
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").split("-")[0];

    return (
        <Link href={href} className="group" prefetch={false}>
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow duration-300">
                <Image
                    src={tmdb.getImageUrl(item.poster_path)}
                    alt={title || "Poster"}
                    fill
                    className="object-cover"
                    loading="lazy"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100">
                    <h4 className="text-sm font-semibold text-white line-clamp-2 leading-tight">{title}</h4>
                    {year && (
                        <span className="text-xs text-white/70 mt-1">{year}</span>
                    )}
                </div>
            </div>
        </Link>
    );
});

// ═══════════════════════════════════════════════════════════════════
// Section Config
// ═══════════════════════════════════════════════════════════════════

const SECTION_CONFIG = [
    { key: "whatsHot", label: "What's Hot This Week", Icon: TrendingUp, defaultType: null },
    { key: "freshEpisodes", label: "New Episodes", Icon: Tv, defaultType: "tv", hasEpisodeInfo: true },
    { key: "inCinemas", label: "In Cinemas", Icon: Clapperboard, defaultType: "movie" },
    { key: "popular", label: "Popular Right Now", Icon: Flame, defaultType: "movie" },
    { key: "bingeWorthy", label: "Binge-Worthy Shows", Icon: Eye, defaultType: "tv" },
    { key: "comingSoon", label: "Coming Soon", Icon: Calendar, defaultType: "movie" },
    { key: "hiddenGems", label: "Hidden Gems", Icon: Gem, defaultType: "movie" },
];

const SectionGrid = memo(function SectionGrid({ items, defaultType, hasEpisodeInfo }) {
    if (!items || items.length === 0) return null;
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
            {items.map((item) => (
                <div key={item.id}>
                    <MediaCard item={item} type={item.media_type || defaultType || "movie"} />
                    {hasEpisodeInfo && item._lastEpisode && (
                        <div className="mt-2 px-1">
                            <p className="text-xs text-white/80 font-medium truncate">{item._lastEpisode.name}</p>
                            <p className="text-[10px] text-textSecondary">
                                S{item._lastEpisode.season_number}E{item._lastEpisode.episode_number} &middot;{" "}
                                {new Date(item._lastEpisode.air_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════════
// Skeletons
// ═══════════════════════════════════════════════════════════════════

function SkeletonHero() {
    return (
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
    );
}

function SkeletonGrids() {
    return (
        <>
            {[0, 1, 2].map((i) => (
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
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// TMDB Fetch Helpers — route through /api/tmdb to keep API key server-side
// ═══════════════════════════════════════════════════════════════════

async function fetchTMDBPage(endpoint, retries = 2) {
    const url = `/api/tmdb?endpoint=${encodeURIComponent(endpoint)}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`TMDB ${res.status}`);
            const data = await res.json();
            return data.results || [];
        } catch (err) {
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
                continue;
            }
            console.error("fetchTMDBPage error:", endpoint, err.message);
            return [];
        }
    }
    return [];
}

async function enrichFreshEpisodes(candidates, sevenDaysAgo, signal) {
    if (!candidates || candidates.length === 0) return [];
    const batch = candidates.slice(0, 15);
    const details = await Promise.allSettled(
        batch.map(async (show) => {
            if (signal?.aborted) return null;
            try {
                const res = await fetch(`/api/tmdb?endpoint=${encodeURIComponent(`tv/${show.id}`)}`);
                if (!res.ok) return null;
                return await res.json();
            } catch {
                return null;
            }
        })
    );

    const enriched = [];
    for (let i = 0; i < batch.length; i++) {
        const detail = details[i]?.status === "fulfilled" ? details[i].value : null;
        if (!detail || !detail.last_episode_to_air) continue;
        const ep = detail.last_episode_to_air;
        if (!ep.air_date) continue;
        if (ep.season_number === 0 || ep.episode_type === "special") continue;
        const airDate = new Date(ep.air_date);
        if (airDate < sevenDaysAgo) continue;
        enriched.push({
            ...batch[i],
            _lastEpisode: {
                name: ep.name,
                air_date: ep.air_date,
                season_number: ep.season_number,
                episode_number: ep.episode_number,
            },
        });
    }
    return enriched;
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function HomePage() {
    const emptySections = {
        whatsHot: [],
        freshEpisodes: [],
        inCinemas: [],
        popular: [],
        bingeWorthy: [],
        comingSoon: [],
        hiddenGems: [],
    };

    // Detect hard refresh — only once
    const isHardRefresh = useRef(false);
    const hardRefreshChecked = useRef(false);

    const [sections, setSections] = useState(emptySections);
    const [heroItem, setHeroItem] = useState(null);
    const [loading, setLoading] = useState(true);

    // Hydration-safe: only read cache after mount
    useEffect(() => {
        if (!hardRefreshChecked.current) {
            hardRefreshChecked.current = true;
            try {
                const navEntries = performance.getEntriesByType("navigation");
                if (navEntries.length > 0 && navEntries[0].type === "reload") {
                    clearSessionCache();
                    isHardRefresh.current = true;
                }
            } catch {}
        }

        if (!isHardRefresh.current) {
            const cached = getSessionCache();
            if (cached?.sections) {
                setSections(cached.sections);
                setLoading(false);
            }
        }
    }, []);

    const [fetchError, setFetchError] = useState(false);
    const { user, loading: authLoading } = useAuth();
    const fetchedRef = useRef(false);
    const lastFetchTime = useRef(0);
    const REFRESH_DEBOUNCE_MS = 5000;

    // ── Pick a random hero from a pool, excluding user's watched items ──
    const pickHero = useCallback((heroPool, userSeenIds) => {
        if (!heroPool || heroPool.length === 0) return null;
        const candidates = heroPool.filter(
            (m) => m.backdrop_path && (!userSeenIds || !userSeenIds.has(m.id))
        );
        if (candidates.length === 0) {
            // Fallback: use all items with backdrop
            const fallback = heroPool.filter((m) => m.backdrop_path);
            if (fallback.length === 0) return null;
            return fallback[Math.floor(Math.random() * fallback.length)];
        }
        return candidates[Math.floor(Math.random() * candidates.length)];
    }, []);

    // ── Main Content Fetcher ──
    const fetchContent = useCallback(async (controller, bypassDebounce = false) => {
        // Debounce rapid refreshes
        if (!bypassDebounce) {
            const now = Date.now();
            if (now - lastFetchTime.current < REFRESH_DEBOUNCE_MS && fetchedRef.current) return;
            lastFetchTime.current = now;
        }

        // Soft navigation: use session cache
        if (!isHardRefresh.current) {
            const cached = getSessionCache();
            if (cached?.sections) {
                setSections(cached.sections);
                // Always re-pick hero on every page visit
                const pool = getSectionCache("heroPool") || [];
                let seenIds = new Set();
                if (user) { try { seenIds = await mediaService.getUserSeenMediaIds(user.uid); } catch {} }
                setHeroItem(pickHero(pool, seenIds));
                setLoading(false);
                fetchedRef.current = true;
                return;
            }
        }

        // Circuit breaker
        if (isCircuitOpen()) {
            const fallback = await getFallbackData();
            if (fallback) {
                setSections(fallback);
                const pool = getSectionCache("heroPool") || [];
                setHeroItem(pickHero(pool, new Set()));
                setLoading(false);
                fetchedRef.current = true;
                return;
            }
        }

        setLoading(true);
        setFetchError(false);

        try {
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // Check per-section caches (stable sections don't refetch until TTL expires)
            const cachedWhatsHot = getSectionCache("whatsHot");
            const cachedFreshEpisodes = getSectionCache("freshEpisodes");
            const cachedInCinemas = getSectionCache("inCinemas");
            const cachedPopular = getSectionCache("popular");
            const cachedBingeWorthy = getSectionCache("bingeWorthy");
            const cachedComingSoon = getSectionCache("comingSoon");
            const cachedHiddenGems = getSectionCache("hiddenGems");
            const cachedHeroPool = getSectionCache("heroPool");

            // Determine what needs fetching
            const needsWhatsHot = !cachedWhatsHot;
            const needsFreshEpisodes = !cachedFreshEpisodes;
            const needsInCinemas = !cachedInCinemas;
            const needsPopular = !cachedPopular;
            const needsBingeWorthy = !cachedBingeWorthy;
            const needsComingSoon = !cachedComingSoon;
            const needsHiddenGems = !cachedHiddenGems;
            const needsHeroPool = !cachedHeroPool;

            const needsAnyFetch = needsWhatsHot || needsFreshEpisodes || needsInCinemas ||
                needsPopular || needsBingeWorthy || needsComingSoon || needsHiddenGems || needsHeroPool;

            // Start user-seen-IDs fetch in parallel (used later in pickHero)
            const userSeenIdsPromise = user
                ? mediaService.getUserSeenMediaIds(user.uid).catch(() => new Set())
                : Promise.resolve(new Set());

            if (!needsAnyFetch) {
                // All sections cached — just use them
                const userSeenIds = await userSeenIdsPromise;
                const newSections = {
                    whatsHot: cachedWhatsHot,
                    freshEpisodes: cachedFreshEpisodes,
                    inCinemas: cachedInCinemas,
                    popular: cachedPopular,
                    bingeWorthy: cachedBingeWorthy,
                    comingSoon: cachedComingSoon,
                    hiddenGems: cachedHiddenGems,
                };
                if (!controller?.signal?.aborted) {
                    setSections(newSections);
                    setHeroItem(pickHero(cachedHeroPool, userSeenIds));
                    setSessionCache({ sections: newSections });
                    setLoading(false);
                    fetchedRef.current = true;
                    isHardRefresh.current = false;
                    recordSuccess();
                }
                return;
            }

            // Fetch only what's needed — use page=1 for stable results (no randomPage)
            const results = await Promise.allSettled([
                needsWhatsHot ? fetchTMDBPage("trending/all/week") : Promise.resolve(null),                           // 0
                needsFreshEpisodes ? fetchTMDBPage("tv/on_the_air?page=1") : Promise.resolve(null),                   // 1
                needsInCinemas ? fetchTMDBPage("movie/now_playing?page=1&region=US") : Promise.resolve(null),         // 2
                needsPopular ? fetchTMDBPage("movie/popular?page=1") : Promise.resolve(null),                         // 3
                needsBingeWorthy ? fetchTMDBPage("discover/tv?vote_average.gte=7.2&vote_count.gte=500&sort_by=vote_average.desc&page=1") : Promise.resolve(null), // 4
                needsComingSoon ? fetchTMDBPage("movie/upcoming?page=1&region=US") : Promise.resolve(null),           // 5
                needsHiddenGems ? fetchTMDBPage("discover/movie?vote_average.gte=7.5&vote_count.gte=100&vote_count.lte=10000&sort_by=vote_average.desc&with_original_language=en&page=1") : Promise.resolve(null), // 6
                needsHeroPool ? fetchTMDBPage("trending/movie/day") : Promise.resolve(null),                          // 7
                needsHeroPool ? fetchTMDBPage("trending/movie/week") : Promise.resolve(null),                         // 8
                needsPopular ? fetchTMDBPage("tv/popular?page=1") : Promise.resolve(null),                            // 9
            ]);

            if (controller?.signal?.aborted) return;

            const extract = (i) => {
                if (results[i]?.status !== "fulfilled") return [];
                const v = results[i].value;
                if (v === null) return []; // Was cached, skip
                if (Array.isArray(v)) return v;
                return v?.results || [];
            };

            // Process each section (only if freshly fetched)
            const whatsHot = needsWhatsHot
                ? extract(0).filter((m) => (m.media_type === "movie" || m.media_type === "tv") && (m.vote_count || 0) > 100 && (m.popularity || 0) > 100).slice(0, 10)
                : cachedWhatsHot;

            let freshEpisodes = cachedFreshEpisodes;
            if (needsFreshEpisodes) {
                freshEpisodes = await enrichFreshEpisodes(extract(1), sevenDaysAgo, controller?.signal);
                freshEpisodes = freshEpisodes.slice(0, 10);
            }

            const inCinemas = needsInCinemas
                ? extract(2).filter((m) => {
                    if (!m.release_date) return false;
                    const rd = new Date(m.release_date);
                    const daysSince = (today - rd) / (1000 * 60 * 60 * 24);
                    return daysSince >= 0 && daysSince <= 45;
                }).slice(0, 10)
                : cachedInCinemas;

            let popular = cachedPopular;
            if (needsPopular) {
                popular = extract(3).filter((m) => (m.vote_count || 0) > 200 && (m.popularity || 0) > 150);
                // Augment with TV popular if thin
                if (popular.length < 5) {
                    popular.push(...extract(9).filter((m) => (m.vote_average || 0) >= 7));
                }
                popular = popular.slice(0, 10);
            }

            const bingeWorthy = needsBingeWorthy
                ? extract(4).slice(0, 10)
                : cachedBingeWorthy;

            const comingSoon = needsComingSoon
                ? extract(5).filter((m) => m.release_date && new Date(m.release_date) > today).slice(0, 10)
                : cachedComingSoon;

            const hiddenGems = needsHiddenGems
                ? extract(6).filter((m) => (m.popularity || 0) < 100).slice(0, 10)
                : cachedHiddenGems;

            // Hero pool: combine trending day + week for large pool
            let heroPool = cachedHeroPool;
            if (needsHeroPool) {
                const dayTrending = extract(7);
                const weekTrending = extract(8);
                const seenHero = new Set();
                heroPool = [];
                for (const m of [...dayTrending, ...weekTrending]) {
                    if (m && m.id && !seenHero.has(m.id) && m.backdrop_path) {
                        seenHero.add(m.id);
                        heroPool.push(m);
                    }
                }
            }

            if (controller?.signal?.aborted) return;

            const newSections = { whatsHot, freshEpisodes, inCinemas, popular, bingeWorthy, comingSoon, hiddenGems };

            // Save per-section caches (only for sections that were freshly fetched)
            if (needsWhatsHot) setSectionCache("whatsHot", whatsHot);
            if (needsFreshEpisodes) setSectionCache("freshEpisodes", freshEpisodes);
            if (needsInCinemas) setSectionCache("inCinemas", inCinemas);
            if (needsPopular) setSectionCache("popular", popular);
            if (needsBingeWorthy) setSectionCache("bingeWorthy", bingeWorthy);
            if (needsComingSoon) setSectionCache("comingSoon", comingSoon);
            if (needsHiddenGems) setSectionCache("hiddenGems", hiddenGems);
            if (needsHeroPool) setSectionCache("heroPool", heroPool);

            if (!controller?.signal?.aborted) {
                const userSeenIds = await userSeenIdsPromise;
                setSections(newSections);
                setHeroItem(pickHero(heroPool, userSeenIds));
                setSessionCache({ sections: newSections });
                saveFallbackData(newSections);
                recordSuccess();
            }
        } catch (error) {
            if (!controller?.signal?.aborted) {
                console.error("Homepage fetch error:", error);
                recordFailure();
                const fallback = await getFallbackData();
                if (fallback) {
                    setSections(fallback);
                    const pool = getSectionCache("heroPool") || [];
                    setHeroItem(pickHero(pool, new Set()));
                } else {
                    setFetchError(true);
                }
            }
        } finally {
            if (!controller?.signal?.aborted) {
                setLoading(false);
                fetchedRef.current = true;
                isHardRefresh.current = false;
            }
        }
    }, [user, pickHero]);

    // ── Initial Load ──
    useEffect(() => {
        if (authLoading) return;
        if (fetchedRef.current) return;
        const controller = new AbortController();
        fetchContent(controller);
        return () => controller.abort();
    }, [authLoading, fetchContent]);

    // ── Invalidate on media update ──
    useEffect(() => {
        const handleMediaUpdate = () => invalidateRecommendationCache();
        eventBus.on("MEDIA_UPDATED", handleMediaUpdate);
        return () => eventBus.off("MEDIA_UPDATED", handleMediaUpdate);
    }, []);

    // ── Determine hero label ──
    const heroCategoryLabel = heroItem
        ? (heroItem.popularity || 0) > 500 ? "Trending" : "Popular Now"
        : "Trending";

    // ── Loading State ──
    if (loading) {
        return (
            <main className="min-h-screen bg-background">
                <SkeletonHero />
                <SkeletonGrids />
            </main>
        );
    }

    const hasContent = Object.values(sections).some((arr) => arr.length > 0);

    const handleRetry = () => {
        // Clear ALL caches for a full refresh
        clearSessionCache();
        Object.keys(SECTION_TTLS).forEach((k) => {
            try { localStorage.removeItem(`vn_sec_${k}`); } catch {}
        });
        fetchedRef.current = false;
        setFetchError(false);
        setLoading(true);
        const controller = new AbortController();
        fetchContent(controller, true);
    };

    return (
        <main className="min-h-screen bg-background">
            {/* ── Error / Empty State ── */}
            {!hasContent && !heroItem && (
                <section className="site-container py-24 text-center">
                    <Sparkles className="mx-auto text-accent mb-4" size={48} />
                    <h2 className="text-2xl font-bold mb-2">
                        {fetchError ? "Unable to load content" : "Content is loading..."}
                    </h2>
                    <p className="text-textSecondary mb-6">
                        {fetchError
                            ? "We could not reach our data sources. Please try again in a moment."
                            : "We are preparing your personalized recommendations."}
                    </p>
                    <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-accent text-background rounded-xl font-bold hover:bg-accent/90 transition"
                    >
                        Refresh
                    </button>
                </section>
            )}

            {/* ── HERO SECTION (MANDATORY — always shows, changes every refresh) ── */}
            {heroItem && (
                <div className="relative w-full pt-16 min-h-[calc(100vh-4rem)]">
                    <div className="absolute inset-0 bg-black">
                        <div className="relative site-container h-full">
                            <Image
                                src={tmdb.getBannerUrl(heroItem.backdrop_path, null)}
                                alt={heroItem.title || heroItem.name || "Featured content"}
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
                                {heroItem.title || heroItem.name}
                            </h1>
                            <p className="text-lg md:text-xl text-textSecondary mb-8 line-clamp-3">
                                {heroItem.overview}
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link href={getMediaUrl(heroItem, heroItem.title ? "movie" : "tv")}>
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

            {/* ── CONTENT SECTIONS (stable — same items until TTL expires) ── */}
            {SECTION_CONFIG.map(({ key, label, Icon, defaultType, hasEpisodeInfo }) => {
                if (!sections[key] || sections[key].length === 0) return null;
                return (
                    <section key={key} className="site-container py-16">
                        <div className="flex items-center gap-3 mb-8">
                            <Icon className="text-accent" size={32} />
                            <h2 className="text-3xl md:text-4xl font-bold">{label}</h2>
                        </div>
                        <SectionGrid
                            items={sections[key]}
                            defaultType={defaultType}
                            hasEpisodeInfo={hasEpisodeInfo}
                        />
                    </section>
                );
            })}

            {/* ── JOIN CTA (only for non-logged-in users) ── */}
            {!user && (
                <section className="site-container py-16">
                    <div className="bg-secondary rounded-2xl p-8 md:p-12 text-center border border-white/5">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Track &middot; Rate &middot; Review &middot; Import
                        </h2>
                        <p className="text-lg md:text-xl text-textSecondary mb-8 max-w-2xl mx-auto">
                            Build your personal movie and TV journal. Track what you watch,
                            rate honestly, and discover what&apos;s truly worth your time.
                        </p>
                        <div className="flex justify-center">
                            <Link href="/signup">
                                <Button size="lg">Get Started Free</Button>
                            </Link>
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}
