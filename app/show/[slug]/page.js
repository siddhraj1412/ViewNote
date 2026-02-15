"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { tmdb } from "@/lib/tmdb";
import ActionBar from "@/components/ActionBar";
import CastGrid from "@/components/CastGrid";
import CrewSection from "@/components/CrewSection";
import ProductionSection from "@/components/ProductionSection";
import RatingDistribution from "@/components/RatingDistribution";
import MediaSection from "@/components/MediaSection";
import ReviewsForMedia from "@/components/ReviewsForMedia";
import SectionTabs from "@/components/SectionTabs";
import SeasonCard from "@/components/SeasonCard";
import TmdbRatingBadge from "@/components/TmdbRatingBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import { Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import { parseSlugId, getMovieUrl, getShowUrl } from "@/lib/slugify";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import showToast from "@/lib/toast";
import { mediaService } from "@/services/mediaService";

const RatingModal = dynamic(() => import("@/components/RatingModal"), { ssr: false, loading: () => null });

export default function ShowSlugPage() {
    const params = useParams();
    const router = useRouter();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const [tv, setTv] = useState(null);
    const [stronglyRelated, setStronglyRelated] = useState([]);
    const [mixedSimilar, setMixedSimilar] = useState([]);
    const [similarFilter, setSimilarFilter] = useState("all");
    const [mediaImages, setMediaImages] = useState({ posters: [], backdrops: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("seasons");

    const [aggregatedRating, setAggregatedRating] = useState(0);

    // Season watch tracking
    const [watchedSeasons, setWatchedSeasons] = useState(new Set());
    // Quick rate state
    const [quickRateOpen, setQuickRateOpen] = useState(false);
    const [quickRateSeasonNum, setQuickRateSeasonNum] = useState(null);

    const { user } = useAuth();
    const userRating = aggregatedRating > 0 ? aggregatedRating : 0;

    const { customPoster, customBanner } = useMediaCustomization(
        tvId,
        "tv",
        tv?.poster_path,
        tv?.backdrop_path
    );

    useEffect(() => {
        if (!tvId) {
            setLoading(false);
            return;
        }

        const fetchTV = async () => {
            try {
                const data = await tmdb.getTVDetails(tvId);
                if (!data) {
                    setLoading(false);
                    return;
                }
                setTv(data);

                // Set page title for SEO
                document.title = `${data.name} (${(data.first_air_date || '').split('-')[0]}) — ViewNote`;

                // Verify URL slug matches
                const correctUrl = getShowUrl(data);
                const currentPath = `/show/${rawSlug}`;
                if (correctUrl !== currentPath) {
                    router.replace(correctUrl, { scroll: false });
                }

                const related = await tmdb.getStronglyRelated(tvId, "tv", data);
                setStronglyRelated(related);

                // Fetch mixed-type similar candidates (movie + tv) once; filter in-memory.
                try {
                    const multi = await tmdb.searchMulti(data.name);
                    const results = Array.isArray(multi?.results) ? multi.results : [];
                    const filtered = results
                        .filter((r) => r && (r.media_type === "movie" || r.media_type === "tv") && r.id)
                        .filter((r) => !(r.media_type === "tv" && String(r.id) === String(tvId)));
                    setMixedSimilar(filtered);
                } catch (_) {
                    setMixedSimilar([]);
                }

                // Fetch images for Media section (single fetch)
                try {
                    const images = await tmdb.getTVImages(tvId);
                    setMediaImages({ posters: images?.posters || [], backdrops: images?.backdrops || [] });
                } catch (_) {
                    setMediaImages({ posters: [], backdrops: [] });
                }
            } catch (error) {
                console.error("Error fetching TV show:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTV();
    }, [tvId]);

    useEffect(() => {
        if (!user?.uid || !tvId) {
            setAggregatedRating(0);
            return;
        }

        const q = query(
            collection(db, "user_ratings"),
            where("userId", "==", user.uid),
            where("mediaType", "==", "tv"),
            where("seriesId", "==", Number(tvId))
        );

        const unsub = onSnapshot(q, (snap) => {
            const ratings = snap.docs
                .map((d) => d.data() || {})
                .filter((r) => (r.targetType === "season" || r.targetType === "episode"))
                .filter((r) => Number(r.rating || 0) > 0);

            if (ratings.length === 0) {
                setAggregatedRating(0);
                return;
            }

            const seasonEpisodeCountMap = Object.fromEntries(
                (Array.isArray(tv?.seasons) ? tv.seasons : [])
                    .filter((s) => s?.season_number != null)
                    .map((s) => [String(s.season_number), Number(s.episode_count || 0)])
            );

            let sum = 0;
            let weightSum = 0;

            for (const r of ratings) {
                const val = Number(r.rating || 0);
                if (!Number.isFinite(val) || val <= 0) continue;
                if (r.targetType === "episode") {
                    sum += val;
                    weightSum += 1;
                    continue;
                }
                if (r.targetType === "season") {
                    const sn = r.seasonNumber != null ? Number(r.seasonNumber) : null;
                    const w = sn != null ? Number(seasonEpisodeCountMap[String(sn)] || 1) : 1;
                    sum += val * Math.max(1, w);
                    weightSum += Math.max(1, w);
                }
            }

            const avg = weightSum > 0 ? (sum / weightSum) : 0;
            setAggregatedRating(Number.isFinite(avg) ? avg : 0);
        }, () => {
            setAggregatedRating(0);
        });

        return () => {
            try { unsub(); } catch (_) {}
        };
    }, [user?.uid, tvId, tv]);

    // Track watched seasons via user_series_progress
    useEffect(() => {
        if (!user?.uid || !tvId) {
            setWatchedSeasons(new Set());
            return;
        }
        const progressRef = doc(db, "user_series_progress", `${user.uid}_${Number(tvId)}`);
        const unsub = onSnapshot(progressRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                const ws = Array.isArray(data.watchedSeasons) ? new Set(data.watchedSeasons.map(Number)) : new Set();
                setWatchedSeasons(ws);
            } else {
                setWatchedSeasons(new Set());
            }
        }, () => setWatchedSeasons(new Set()));
        return () => { try { unsub(); } catch (_) {} };
    }, [user?.uid, tvId]);

    const handleToggleSeasonWatched = useCallback(async (seasonNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        try {
            const seriesData = { name: tv?.name || tv?.title || "", title: tv?.name || tv?.title || "", poster_path: tv?.poster_path || "" };
            if (watchedSeasons.has(seasonNum)) {
                await mediaService.unwatchTVSeason(user, tvId, seasonNum, seasonEpisodeCountMap);
            } else {
                await mediaService.markTVSeasonWatched(user, tvId, seriesData, seasonNum, seasonEpisodeCountMap, {});
            }
        } catch (err) {
            console.error("Error toggling season watched:", err);
            showToast.error("Failed to update");
        }
    }, [user, tvId, tv, watchedSeasons, seasonEpisodeCountMap]);

    const handleQuickRateSeason = useCallback((seasonNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        setQuickRateSeasonNum(seasonNum);
        setQuickRateOpen(true);
    }, [user]);

    const similarItemsAll = useMemo(() => {
        const items = [];
        (Array.isArray(stronglyRelated) ? stronglyRelated : []).forEach((r) => {
            if (!r || !r.id) return;
            items.push({
                ...r,
                media_type: "tv",
            });
        });

        (Array.isArray(mixedSimilar) ? mixedSimilar : []).forEach((r) => {
            if (!r || !r.id) return;
            items.push(r);
        });

        const unique = new Map();
        items.forEach((item) => {
            const t = item.media_type || "tv";
            const key = `${t}_${item.id}`;
            if (!unique.has(key)) unique.set(key, item);
        });
        return Array.from(unique.values());
    }, [stronglyRelated, mixedSimilar]);

    const filteredSimilar = useMemo(() => {
        if (similarFilter === "all") return similarItemsAll;
        if (similarFilter === "movie") return similarItemsAll.filter((i) => (i.media_type || "tv") === "movie");
        if (similarFilter === "series") return similarItemsAll.filter((i) => i.media_type === "tv");
        return similarItemsAll;
    }, [similarItemsAll, similarFilter]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!tv) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">TV show not found</div>
            </div>
        );
    }

    const seasonOptions = Array.isArray(tv.seasons)
        ? tv.seasons
            .filter((s) => (s?.season_number ?? null) != null)
            .sort((a, b) => {
                const an = Number(a?.season_number ?? 0);
                const bn = Number(b?.season_number ?? 0);
                const aIsSpecial = an === 0;
                const bIsSpecial = bn === 0;
                if (aIsSpecial && !bIsSpecial) return 1;
                if (!aIsSpecial && bIsSpecial) return -1;
                return an - bn;
            })
        : [];

    const bannerUrl = tmdb.getBannerUrl(
        customBanner || tv.backdrop_path,
        tv.poster_path
    );
    const posterUrl = tmdb.getImageUrl(customPoster || tv.poster_path, "w500");

    return (
        <main className="min-h-screen bg-background">
            <div className="relative w-full pt-16 min-h-[calc(100vh-4rem)]">
                <div className="absolute inset-0 bg-black">
                    <Image
                        src={bannerUrl}
                        alt={tv.name}
                        fill
                        className="object-contain object-center"
                        priority
                        quality={90}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
                </div>

                <div className="relative site-container pt-24 md:pt-32 pb-12">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-full md:w-80 flex-shrink-0">
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                                <Image
                                    src={posterUrl}
                                    alt={tv.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg">
                                {tv.name}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-base md:text-lg">
                                {tv.first_air_date && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={20} className="text-accent" />
                                        <span className="font-medium">
                                            {new Date(tv.first_air_date).getFullYear()}
                                            {Array.isArray(tv.seasons)
                                                ? ` • ${(tv.seasons || []).filter((s) => Number(s?.season_number) > 0).length} Seasons`
                                                : ""}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {tv.genres && tv.genres.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {tv.genres.map((genre) => (
                                        <span
                                            key={genre.id}
                                            className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium"
                                        >
                                            {genre.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {tv.overview && (
                                <p className="text-base md:text-lg text-textSecondary leading-relaxed">
                                    {tv.overview}
                                </p>
                            )}

                            {(() => {
                                const hq = tv?.production_companies?.[0]?.origin_country || null;
                                const oc = Array.isArray(tv?.origin_country) ? tv.origin_country[0] : null;
                                const loc = hq || oc || null;
                                if (!loc) return null;
                                return (
                                    <div className="text-sm text-textSecondary">
                                        Location: {loc}
                                    </div>
                                );
                            })()}

                            <ActionBar
                                mediaId={tvId}
                                mediaType="tv"
                                title={tv.name}
                                posterPath={tv.poster_path}
                                currentRating={userRating}
                                releaseYear={tv.first_air_date ? tv.first_air_date.slice(0, 4) : ""}
                                seasons={tv.seasons || []}
                                tvTargetType="series"
                                seasonEpisodeCounts={Object.fromEntries(
                                    (Array.isArray(tv.seasons) ? tv.seasons : [])
                                        .filter((s) => s?.season_number != null)
                                        .map((s) => [String(s.season_number), Number(s.episode_count || 0)])
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="site-container py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <RatingDistribution mediaId={tvId} mediaType="tv" />
                        <TmdbRatingBadge value={tv.vote_average} />
                        <StreamingAvailability mediaType="tv" mediaId={tvId} />
                    </div>

                    <div className="lg:col-span-8">
                        <SectionTabs
                            tabs={[
                                { id: "seasons", label: "Seasons" },
                                { id: "cast", label: "Cast" },
                                { id: "crew", label: "Crew" },
                                { id: "production", label: "Production" },
                                { id: "reviews", label: "Reviews" },
                                { id: "media", label: "Media" },
                                { id: "similar", label: "Similar" },
                            ]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                        />

                        <div className="space-y-16">
                            {activeTab === "seasons" && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Seasons</h2>

                                    {seasonOptions.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {seasonOptions.map((s) => (
                                                <SeasonCard
                                                    key={s.id}
                                                    rawShowSlug={rawSlug}
                                                    seriesId={tvId}
                                                    season={s}
                                                    isWatched={watchedSeasons.has(Number(s.season_number))}
                                                    onToggleWatched={user ? handleToggleSeasonWatched : undefined}
                                                    onQuickRate={user ? handleQuickRateSeason : undefined}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {activeTab === "cast" && tv.credits?.cast && tv.credits.cast.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Cast</h2>
                                    <CastGrid cast={tv.credits.cast} />
                                </section>
                            )}

                            {activeTab === "crew" && tv.credits?.crew && tv.credits.crew.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Crew</h2>
                                    <CrewSection crew={tv.credits.crew} />
                                </section>
                            )}

                            {activeTab === "production" && tv.production_companies && tv.production_companies.length > 0 && (
                                <ProductionSection productions={tv.production_companies} />
                            )}

                            {activeTab === "reviews" && (
                                <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} />
                            )}

                            {activeTab === "media" && (
                                <MediaSection
                                    title="Media"
                                    posters={mediaImages.posters}
                                    backdrops={mediaImages.backdrops}
                                    videos={tv.videos?.results || []}
                                />
                            )}

                            {activeTab === "similar" && (
                                <section>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                        <h2 className="text-3xl font-bold">Similar</h2>
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { id: "all", label: "All" },
                                                { id: "movie", label: "Movie" },
                                                { id: "series", label: "Series" },
                                            ].map((f) => (
                                                <button
                                                    key={f.id}
                                                    onClick={() => setSimilarFilter(f.id)}
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                                        similarFilter === f.id
                                                            ? "bg-accent text-white"
                                                            : "bg-white/5 text-textSecondary hover:text-white"
                                                    }`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {filteredSimilar.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {filteredSimilar.map((related) => {
                                                const isMovie = related.media_type === "movie";
                                                const href = isMovie ? getMovieUrl(related) : getShowUrl(related);
                                                const relatedTitle = related.title || related.name;
                                                const poster = related.poster_path;
                                                return (
                                                    <Link key={`${related.media_type || "tv"}_${related.id}`} href={href} className="group">
                                                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-secondary">
                                                            <Image
                                                                src={tmdb.getImageUrl(poster)}
                                                                alt={relatedTitle}
                                                                fill
                                                                className="object-cover"
                                                            />
                                                            {related.similarityScore && (
                                                                <div className="absolute top-2 right-2 bg-accent text-background px-2 py-1 rounded text-xs font-bold">
                                                                    {related.similarityScore}%
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h3 className="font-medium text-sm line-clamp-2">{relatedTitle}</h3>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="bg-secondary rounded-xl border border-white/5 p-6">
                                            <div className="text-sm text-textSecondary">No similar items found for this filter.</div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Rate Modal for season-level rating from card */}
            {quickRateOpen && tv && (
                <RatingModal
                    isOpen={quickRateOpen}
                    onClose={() => { setQuickRateOpen(false); setQuickRateSeasonNum(null); }}
                    mediaId={tvId}
                    mediaType="tv"
                    title={tv.name}
                    poster_path={tv.poster_path}
                    currentRating={0}
                    releaseYear={tv.first_air_date ? tv.first_air_date.slice(0, 4) : ""}
                    mode="normal"
                    seasons={tv.seasons || []}
                    seriesId={tvId}
                    initialSeasonNumber={quickRateSeasonNum}
                    initialEpisodeNumber={null}
                />
            )}
        </main>
    );
}
