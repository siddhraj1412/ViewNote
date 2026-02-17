"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { tmdb } from "@/lib/tmdb";
import { parseSlugId, getShowUrl } from "@/lib/slugify";
import ActionBar from "@/components/ActionBar";
import CastGrid from "@/components/CastGrid";
import CrewSection from "@/components/CrewSection";
import ProductionSection from "@/components/ProductionSection";
import RatingDistribution from "@/components/RatingDistribution";
import MediaSection from "@/components/MediaSection";
import ReviewsForMedia from "@/components/ReviewsForMedia";
import SectionTabs from "@/components/SectionTabs";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import ExpandableText from "@/components/ExpandableText";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import { Eye, EyeOff, Star } from "lucide-react";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

const RatingModal = dynamic(() => import("@/components/RatingModal"), { ssr: false, loading: () => null });

export default function SeasonPage() {
    const params = useParams();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const seasonNumber = Number(params.seasonNumber);

    const [tv, setTv] = useState(null);
    const [season, setSeason] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("episodes");

    // Episode watch tracking
    const [watchedEpisodes, setWatchedEpisodes] = useState(new Set());
    // Quick rate state
    const [quickRateOpen, setQuickRateOpen] = useState(false);
    const [quickRateEpNum, setQuickRateEpNum] = useState(null);

    const { user } = useAuth();

    const customizationMediaId = tvId && Number.isFinite(seasonNumber) ? `${tvId}_season_${seasonNumber}` : null;
    const { customPoster } = useMediaCustomization(
        customizationMediaId,
        "tv",
        season?.poster_path || tv?.poster_path,
        null
    );

    useEffect(() => {
        if (!tvId || !Number.isFinite(seasonNumber)) {
            setLoading(false);
            return;
        }

        const run = async () => {
            try {
                const [tvData, seasonData] = await Promise.all([
                    tmdb.getTVDetails(tvId),
                    tmdb.getTVSeasonDetails(tvId, seasonNumber),
                ]);
                setTv(tvData || null);
                setSeason(seasonData || null);
            } catch {
                setTv(null);
                setSeason(null);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [tvId, seasonNumber]);

    const episodes = useMemo(() => {
        return Array.isArray(season?.episodes) ? season.episodes : [];
    }, [season]);

    // Track watched episodes via user_series_progress
    useEffect(() => {
        if (!user?.uid || !tvId) {
            setWatchedEpisodes(new Set());
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
                setWatchedEpisodes(new Set());
                return;
            }
            const epMap = data.watchedEpisodes || {};
            const epList = Array.isArray(epMap[String(seasonNumber)]) ? epMap[String(seasonNumber)].map(Number) : [];
            setWatchedEpisodes(new Set(epList));
        };

        fetchProgress();

        const channel = supabase
            .channel(`season-progress-${progressId}-${seasonNumber}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "user_series_progress", filter: `id=eq.${progressId}` }, () => {
                fetchProgress();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.uid, tvId, seasonNumber]);

    const handleToggleEpisodeWatched = useCallback(async (epNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        const progressId = `${user.uid}_${Number(tvId)}`;
        const wasWatched = watchedEpisodes.has(epNum);

        // Optimistic update
        setWatchedEpisodes((prev) => {
            const next = new Set(prev);
            if (wasWatched) next.delete(epNum);
            else next.add(epNum);
            return next;
        });

        try {
            const { data: existing } = await supabase
                .from("user_series_progress")
                .select("*")
                .eq("id", progressId)
                .single();
            const data = existing || {};
            const epMap = data.watchedEpisodes || {};
            const current = Array.isArray(epMap[String(seasonNumber)]) ? epMap[String(seasonNumber)].map(Number) : [];
            const currentSet = new Set(current);
            if (wasWatched) {
                currentSet.delete(epNum);
                showToast.success(`Episode ${epNum} unmarked`);
            } else {
                currentSet.add(epNum);
                showToast.success(`Episode ${epNum} marked as watched`);
            }
            const newEpMap = { ...epMap, [String(seasonNumber)]: Array.from(currentSet).sort((a, b) => a - b) };

            // Auto-mark season if all episodes watched, but NEVER auto-unmark
            const totalEps = episodes.length;
            const watchedSeasonsSet = Array.isArray(data.watchedSeasons) ? new Set(data.watchedSeasons.map(Number)) : new Set();
            if (currentSet.size >= totalEps && totalEps > 0) {
                watchedSeasonsSet.add(seasonNumber);
            }

            await supabase.from("user_series_progress").upsert({
                id: progressId,
                watchedEpisodes: newEpMap,
                watchedSeasons: Array.from(watchedSeasonsSet),
                userId: user.uid,
                seriesId: Number(tvId),
            });
            eventBus.emit("MEDIA_UPDATED", { mediaId: tvId, mediaType: "tv", action: wasWatched ? "EPISODE_UNWATCHED" : "EPISODE_WATCHED", userId: user.uid });
        } catch (err) {
            // Revert optimistic update
            setWatchedEpisodes((prev) => {
                const next = new Set(prev);
                if (wasWatched) next.add(epNum);
                else next.delete(epNum);
                return next;
            });
            console.error("Error toggling episode watched:", err);
            showToast.error("Failed to update");
        }
    }, [user, tvId, seasonNumber, episodes.length, watchedEpisodes]);

    const handleQuickRateEpisode = useCallback((epNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        setQuickRateEpNum(epNum);
        setQuickRateOpen(true);
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!tv || !season) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Season not found</div>
            </div>
        );
    }

    const backToShow = getShowUrl(tv);
    const seasonPosterUrl = tmdb.getImageUrl(customPoster || season.poster_path || tv.poster_path, "w500", "poster");
    const seasonStatsId = `tv_${Number(tvId)}_season_${Number(seasonNumber)}`;

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="site-container py-10">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-full md:w-80 flex-shrink-0">
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-white/5">
                            <Image
                                src={seasonPosterUrl}
                                alt={season.name || `Season ${seasonNumber}`}
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                    </div>

                    <div className="flex-1 space-y-5">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold">
                                {season.name || `Season ${seasonNumber}`}
                            </h1>
                            <div className="text-sm text-textSecondary mt-2">
                                {tv.name} • Season {seasonNumber}
                            </div>
                        </div>

                        {season.overview ? (
                            <ExpandableText
                                text={season.overview}
                                maxLines={4}
                                className="text-base md:text-lg text-textSecondary leading-relaxed"
                            />
                        ) : null}

                        <ActionBar
                            mediaId={tvId}
                            mediaType="tv"
                            title={tv.name}
                            posterPath={tv.poster_path}
                            currentRating={0}
                            releaseYear={tv.first_air_date ? tv.first_air_date.slice(0, 4) : ""}
                            seasons={tv.seasons || []}
                            initialSeasonNumber={seasonNumber}
                            tvTargetType="season"
                            tvSeasonNumber={seasonNumber}
                            seasonEpisodeCounts={Object.fromEntries(
                                (Array.isArray(tv.seasons) ? tv.seasons : [])
                                    .filter((s) => s?.season_number != null)
                                    .map((s) => [String(s.season_number), Number(s.episode_count || 0)])
                            )}
                            allowPosterCustomization={true}
                            allowBannerCustomization={false}
                            customizationMediaId={`${tvId}_season_${seasonNumber}`}
                            customizationMediaType="tv"
                            customizationPosterPath={season.poster_path || tv.poster_path}
                            posterTmdbEndpoint={`tv/${tvId}/season/${seasonNumber}/images`}
                            customPoster={customPoster}
                        />

                        <Link
                            href={backToShow}
                            className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                        >
                            Back to show
                        </Link>
                    </div>
                </div>
            </div>

            <div className="site-container py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <RatingDistribution mediaId={tvId} mediaType="tv" statsId={seasonStatsId} />
                        {season.vote_average > 0 && (
                            <div className="text-xs text-textSecondary">
                                TMDB Rating: {Number(season.vote_average || 0).toFixed(1)} / 10
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-8">
                        <SectionTabs
                            tabs={[
                                { id: "episodes", label: "Episodes" },
                                { id: "cast", label: "Cast" },
                                { id: "crew", label: "Crew" },
                                { id: "production", label: "Production" },
                                { id: "reviews", label: "Reviews" },
                                { id: "media", label: "Media" },
                            ]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                        />

                        <div className="space-y-16">
                            {activeTab === "episodes" && episodes.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Episodes</h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {episodes.map((ep) => {
                                            const href = `/show/${encodeURIComponent(rawSlug)}/season/${params.seasonId}/${seasonNumber}/episode/${ep.episode_number}`;
                                            const epThumb = tmdb.getImageUrl(ep.still_path || season.poster_path || tv.poster_path, "w500", "poster");
                                            const epWatched = watchedEpisodes.has(Number(ep.episode_number));
                                            return (
                                                <Link key={ep.id} href={href} className="group">
                                                    <div className="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all">
                                                        <div className="relative aspect-video bg-white/5">
                                                            <Image
                                                                src={epThumb}
                                                                alt={ep.name || `Episode ${ep.episode_number}`}
                                                                fill
                                                                className="object-cover"
                                                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                                                loading="lazy"
                                                            />
                                                            {/* Overlay icons */}
                                                            <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                                                                {user && (
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleEpisodeWatched(ep.episode_number); }}
                                                                        className={`p-1.5 rounded-lg backdrop-blur-sm transition-all ${
                                                                            epWatched
                                                                                ? "bg-accent/90 text-white"
                                                                                : "bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white"
                                                                        }`}
                                                                        title={epWatched ? "Mark as unwatched" : "Mark as watched"}
                                                                    >
                                                                        {epWatched ? <Eye size={13} /> : <EyeOff size={13} />}
                                                                    </button>
                                                                )}
                                                                {user && (
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickRateEpisode(ep.episode_number); }}
                                                                        className="p-1.5 rounded-lg bg-black/60 text-white/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:text-accent transition-all"
                                                                        title="Rate this episode"
                                                                    >
                                                                        <Star size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="p-4">
                                                            <div className="text-sm font-bold text-white line-clamp-1">
                                                                E{ep.episode_number}: {ep.name}
                                                            </div>
                                                            {ep.overview ? (
                                                                <div className="text-sm text-textSecondary mt-2 line-clamp-3">{ep.overview}</div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {activeTab === "cast" && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Cast</h2>
                                    {season.credits?.cast && season.credits.cast.length > 0 ? (
                                        <CastGrid cast={season.credits.cast} />
                                    ) : tv?.credits?.cast && tv.credits.cast.length > 0 ? (
                                        <>
                                            <p className="text-sm text-textSecondary mb-4">Showing series cast</p>
                                            <CastGrid cast={tv.credits.cast} />
                                        </>
                                    ) : (
                                        <p className="text-sm text-textSecondary">No cast information available for this season.</p>
                                    )}
                                </section>
                            )}

                            {activeTab === "crew" && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Crew</h2>
                                    {season.credits?.crew && season.credits.crew.length > 0 ? (
                                        <CrewSection crew={season.credits.crew} />
                                    ) : (
                                        <p className="text-sm text-textSecondary">No crew information available for this season.</p>
                                    )}
                                </section>
                            )}

                            {activeTab === "production" && tv.production_companies && tv.production_companies.length > 0 && (
                                <ProductionSection productions={tv.production_companies} />
                            )}

                            {activeTab === "reviews" && (
                                <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} tvTargetType="season" tvSeasonNumber={seasonNumber} />
                            )}

                            {activeTab === "media" && (
                                <MediaSection title="Media" posters={season.images?.posters || []} backdrops={[]} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Rate Modal for episode-level rating from card */}
            {quickRateOpen && tv && (
                <RatingModal
                    isOpen={quickRateOpen}
                    onClose={() => { setQuickRateOpen(false); setQuickRateEpNum(null); }}
                    mediaId={tvId}
                    mediaType="tv"
                    title={tv.name}
                    poster_path={tv.poster_path}
                    currentRating={0}
                    releaseYear={tv.first_air_date ? tv.first_air_date.slice(0, 4) : ""}
                    mode="normal"
                    seasons={tv.seasons || []}
                    seriesId={tvId}
                    initialSeasonNumber={seasonNumber}
                    initialEpisodeNumber={quickRateEpNum}
                />
            )}
        </main>
    );
}
