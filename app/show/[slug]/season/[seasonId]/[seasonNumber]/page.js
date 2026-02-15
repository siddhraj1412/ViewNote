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
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Eye, EyeOff, Star } from "lucide-react";
import showToast from "@/lib/toast";
import TmdbRatingBadge from "@/components/TmdbRatingBadge";
import { mediaService } from "@/services/mediaService";
import StreamingAvailability from "@/components/StreamingAvailability";

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
        const progressRef = doc(db, "user_series_progress", `${user.uid}_${Number(tvId)}`);
        const unsub = onSnapshot(progressRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() || {};
                const epMap = data.watchedEpisodes || {};
                const epList = Array.isArray(epMap[String(seasonNumber)]) ? epMap[String(seasonNumber)].map(Number) : [];
                setWatchedEpisodes(new Set(epList));
            } else {
                setWatchedEpisodes(new Set());
            }
        }, () => setWatchedEpisodes(new Set()));
        return () => { try { unsub(); } catch (_) {} };
    }, [user?.uid, tvId, seasonNumber]);

    const handleToggleEpisodeWatched = useCallback(async (epNum) => {
        if (!user) { showToast.info("Please sign in"); return; }
        try {
            const seriesData = { name: tv?.name || tv?.title || "", title: tv?.name || tv?.title || "", poster_path: tv?.poster_path || "" };
            if (watchedEpisodes.has(epNum)) {
                await mediaService.unwatchTVEpisode(user, tvId, seasonNumber, epNum, seasonEpisodeCountMap);
            } else {
                await mediaService.markTVEpisodeWatched(user, tvId, seriesData, seasonNumber, epNum, seasonEpisodeCountMap, {});
            }
        } catch (err) {
            console.error("Error toggling episode watched:", err);
            showToast.error("Failed to update");
        }
    }, [user, tvId, seasonNumber, tv, watchedEpisodes, seasonEpisodeCountMap]);

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
                            <p className="text-base md:text-lg text-textSecondary leading-relaxed">
                                {season.overview}
                            </p>
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
                        <TmdbRatingBadge value={season.vote_average} />
                        <StreamingAvailability mediaType="tv" mediaId={tvId} />
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

                            {activeTab === "cast" && season.credits?.cast && season.credits.cast.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Cast</h2>
                                    <CastGrid cast={season.credits.cast} />
                                </section>
                            )}

                            {activeTab === "crew" && season.credits?.crew && season.credits.crew.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Crew</h2>
                                    <CrewSection crew={season.credits.crew} />
                                </section>
                            )}

                            {activeTab === "production" && tv.production_companies && tv.production_companies.length > 0 && (
                                <ProductionSection productions={tv.production_companies} />
                            )}

                            {activeTab === "reviews" && (
                                <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} />
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
