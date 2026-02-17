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
import StreamingAvailability from "@/components/StreamingAvailability";
import TmdbRatingBadge from "@/components/TmdbRatingBadge";
import SeasonCard from "@/components/SeasonCard";
import { Calendar, Clock, Globe, Award, Tv as TvIcon } from "lucide-react";
import ExpandableText from "@/components/ExpandableText";
import { useAuth } from "@/context/AuthContext";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import { parseSlugId, getMovieUrl, getShowUrl } from "@/lib/slugify";
import supabase from "@/lib/supabase";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

const RatingModal = dynamic(() => import("@/components/RatingModal"), { ssr: false, loading: () => null });

export default function ShowSlugPage() {
    const params = useParams();
    const router = useRouter();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const [tv, setTv] = useState(null);
    const [stronglyRelated, setStronglyRelated] = useState([]);
    const [similarFilter, setSimilarFilter] = useState("all");
    const [mediaImages, setMediaImages] = useState({ posters: [], backdrops: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("seasons");

    const [aggregatedRating, setAggregatedRating] = useState(0);

    // Season watch tracking
    const [watchedSeasons, setWatchedSeasons] = useState(new Set());
    // Season-level user ratings map { seasonNum: rating }
    const [seasonRatingsMap, setSeasonRatingsMap] = useState({});
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

        // Reset state when navigating between shows (React reuses component instance)
        setTv(null);
        setStronglyRelated([]);
        setSimilarFilter("all");
        setMediaImages({ posters: [], backdrops: [] });
        setActiveTab("seasons");
        setAggregatedRating(0);
        setWatchedSeasons(new Set());
        setSeasonRatingsMap({});
        setQuickRateOpen(false);
        setQuickRateSeasonNum(null);
        setError(null);

        const fetchTV = async () => {
            try {
                const data = await tmdb.getTVDetails(tvId);
                if (!data) {
                    setLoading(false);
                    return;
                }
                setTv(data);

                // Set page title for SEO
                document.title = `${data.name} (${(data.first_air_date || '').split('-')[0]}) - ViewNote`;

                // Verify URL slug matches
                const correctUrl = getShowUrl(data);
                const currentPath = `/show/${rawSlug}`;
                if (correctUrl !== currentPath) {
                    router.replace(correctUrl, { scroll: false });
                }

                const related = await tmdb.getStronglyRelated(tvId, "tv", data);
                setStronglyRelated(related);

                // Fetch images for Media section (single fetch)
                try {
                    const images = await tmdb.getTVImages(tvId);
                    setMediaImages({ posters: images?.posters || [], backdrops: images?.backdrops || [] });
                } catch (_) {
                    setMediaImages({ posters: [], backdrops: [] });
                }
            } catch (error) {
                console.error("Error fetching TV show:", error);
                setTv(null);
                setError(error.message || "Failed to load TV show");
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

        const processRatings = (rows) => {
            const ratings = rows
                .filter((r) => (r.targetType === "season" || r.targetType === "episode"))
                .filter((r) => Number(r.rating || 0) > 0);

            const sMap = {};
            rows.forEach((r) => {
                if (r.targetType === "season" && Number(r.rating || 0) > 0 && r.seasonNumber != null) {
                    sMap[Number(r.seasonNumber)] = Number(r.rating);
                }
            });
            setSeasonRatingsMap(sMap);

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
        };

        const fetchRatings = async () => {
            const { data } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("userId", user.uid)
                .eq("mediaType", "tv")
                .eq("seriesId", Number(tvId));
            processRatings(data || []);
        };

        fetchRatings();

        const channel = supabase
            .channel(`show-ratings-${user.uid}-${tvId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "user_ratings", filter: `userId=eq.${user.uid}` }, () => {
                fetchRatings();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.uid, tvId, tv]);

    // Track watched seasons via user_series_progress
    useEffect(() => {
        if (!user?.uid || !tvId) {
            setWatchedSeasons(new Set());
            return;
        }
        const progressId = `${user.uid}_${Number(tvId)}`;
        const fetchProgress = async () => {
            const { data, error } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .single();
            if (error || !data) {
                setWatchedSeasons(new Set());
                return;
            }
            const ws = Array.isArray(data.watchedSeasons) ? new Set(data.watchedSeasons.map(Number)) : new Set();
            setWatchedSeasons(ws);
        };

        fetchProgress();

        const channel = supabase
            .channel(`progress-${progressId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "user_series_progress", filter: `id=eq.${progressId}` }, () => {
                fetchProgress();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.uid, tvId]);

    const handleToggleSeasonWatched = useCallback(async (seasonNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        const progressId = `${user.uid}_${Number(tvId)}`;
        const wasWatched = watchedSeasons.has(seasonNum);

        // Optimistic update
        setWatchedSeasons((prev) => {
            const next = new Set(prev);
            if (wasWatched) next.delete(seasonNum);
            else next.add(seasonNum);
            return next;
        });

        try {
            const { data: existing } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .single();
            const data = existing || {};
            const current = Array.isArray(data.watchedSeasons) ? data.watchedSeasons.map(Number) : [];
            const currentSet = new Set(current);
            const existingEpMap = data.watchedEpisodes && typeof data.watchedEpisodes === "object" ? { ...data.watchedEpisodes } : {};

            if (wasWatched) {
                currentSet.delete(seasonNum);
                showToast.success(`Season ${seasonNum} unmarked`);
            } else {
                currentSet.add(seasonNum);
                const seasonMeta = Array.isArray(tv?.seasons) ? tv.seasons.find((s) => Number(s?.season_number) === seasonNum) : null;
                const epCount = seasonMeta ? Number(seasonMeta.episode_count || 0) : 0;
                if (epCount > 0) {
                    existingEpMap[String(seasonNum)] = Array.from({ length: epCount }, (_, i) => i + 1);
                }
                showToast.success(`Season ${seasonNum} marked as watched`);
            }
            await supabase.from("user_series_progress").upsert({ id: progressId, watchedSeasons: Array.from(currentSet), watchedEpisodes: existingEpMap, userId: user.uid, seriesId: Number(tvId) });
            eventBus.emit("MEDIA_UPDATED", { mediaId: tvId, mediaType: "tv", action: wasWatched ? "SEASON_UNWATCHED" : "SEASON_WATCHED", userId: user.uid });
        } catch (err) {
            // Revert optimistic update
            setWatchedSeasons((prev) => {
                const next = new Set(prev);
                if (wasWatched) next.add(seasonNum);
                else next.delete(seasonNum);
                return next;
            });
            console.error("Error toggling season watched:", err);
            showToast.error("Failed to update");
        }
    }, [user, tvId, tv?.seasons, watchedSeasons]);

    const handleQuickRateSeason = useCallback((seasonNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        setQuickRateSeasonNum(seasonNum);
        setQuickRateOpen(true);
    }, [user]);

    const similarItemsAll = useMemo(() => {
        return (Array.isArray(stronglyRelated) ? stronglyRelated : []).filter((r) => r && r.id).map((r) => ({
            ...r,
            media_type: r.media_type || "tv",
        }));
    }, [stronglyRelated]);

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
            <div className="min-h-screen bg-background flex flex-col items-center justify-center pt-16 gap-4">
                <div className="text-2xl text-textSecondary">{error ? "Something went wrong" : "TV show not found"}</div>
                {error && (
                    <>
                        <p className="text-sm text-textSecondary/70">{error}</p>
                        <button
                            onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
                            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition text-sm"
                        >
                            Try Again
                        </button>
                    </>
                )}
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
                                <ExpandableText
                                    text={tv.overview}
                                    maxLines={4}
                                    className="text-base md:text-lg text-textSecondary leading-relaxed"
                                />
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
                                customPoster={customPoster}
                                customBanner={customBanner}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="site-container py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <RatingDistribution mediaId={tvId} mediaType="tv" />
                        {tv.vote_average > 0 && (
                            <TmdbRatingBadge value={tv.vote_average} />
                        )}

                        {/* TV Show Details / Metadata */}
                        <div className="space-y-2 text-sm text-textSecondary">
                            {(() => {
                                const usRating = tv.content_ratings?.results?.find(r => r.iso_3166_1 === "US");
                                const cert = usRating?.rating;
                                if (!cert) return null;
                                return (
                                    <div className="flex items-center gap-2">
                                        <Award size={14} className="text-accent shrink-0" />
                                        <span className="font-medium text-white px-1.5 py-0.5 border border-white/20 rounded text-xs">{cert}</span>
                                        <span className="text-xs opacity-60">Rating</span>
                                    </div>
                                );
                            })()}
                            {tv.episode_run_time && tv.episode_run_time.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-accent shrink-0" />
                                    <span>Avg. Runtime: {tv.episode_run_time[0]}m</span>
                                </div>
                            )}
                            {tv.original_language && (
                                <div className="flex items-center gap-2">
                                    <Globe size={14} className="text-accent shrink-0" />
                                    <span>Original Language: {new Intl.DisplayNames(["en"], { type: "language" }).of(tv.original_language)}</span>
                                </div>
                            )}
                            {Array.isArray(tv.seasons) && tv.seasons.filter(s => Number(s?.season_number) > 0).length > 0 && (
                                <div className="flex items-center gap-2">
                                    <TvIcon size={14} className="text-accent shrink-0" />
                                    <span>Episodes per Season: {tv.seasons.filter(s => Number(s?.season_number) > 0).map(s => `S${s.season_number}: ${s.episode_count}`).join(", ")}</span>
                                </div>
                            )}
                        </div>

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
                                                    userRating={seasonRatingsMap[Number(s.season_number)] || 0}
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
                                <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} tvTargetType="series" />
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
