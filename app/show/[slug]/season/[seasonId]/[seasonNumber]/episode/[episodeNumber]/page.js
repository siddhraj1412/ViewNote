"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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

export default function EpisodePage() {
    const params = useParams();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const seasonId = params.seasonId;
    const seasonNumber = Number(params.seasonNumber);
    const episodeNumber = Number(params.episodeNumber);

    const [tv, setTv] = useState(null);
    const [episode, setEpisode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("cast");

    const customizationMediaId = tvId && Number.isFinite(seasonNumber) && Number.isFinite(episodeNumber)
        ? `${tvId}_s${seasonNumber}e${episodeNumber}`
        : null;
    const { customBanner } = useMediaCustomization(
        customizationMediaId,
        "tv",
        null,
        null
    );

    useEffect(() => {
        if (!tvId || !Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) {
            setLoading(false);
            return;
        }

        const run = async () => {
            try {
                const [tvData, epData] = await Promise.all([
                    tmdb.getTVDetails(tvId),
                    tmdb.getTVEpisodeDetails(tvId, seasonNumber, episodeNumber),
                ]);
                setTv(tvData || null);
                setEpisode(epData || null);
            } catch {
                setTv(null);
                setEpisode(null);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [tvId, seasonNumber, episodeNumber]);

    const backToSeasonHref = useMemo(() => {
        return `/show/${encodeURIComponent(rawSlug)}/season/${seasonId}/${seasonNumber}`;
    }, [rawSlug, seasonId, seasonNumber]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!tv || !episode) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Episode not found</div>
            </div>
        );
    }

    const seasonFromTv = Array.isArray(tv?.seasons)
        ? tv.seasons.find((s) => Number(s?.season_number) === seasonNumber)
        : null;
    const episodeBannerPath = episode.still_path || seasonFromTv?.poster_path || tv.backdrop_path || null;
    const episodePosterPath = episode.still_path || seasonFromTv?.poster_path || tv.poster_path || null;

    // Prefer custom banner (reactive via onSnapshot) over TMDB defaults
    const bannerUrl = tmdb.getBannerUrl(customBanner || episodeBannerPath, tv.poster_path);
    const posterUrl = tmdb.getImageUrl(episodePosterPath, "w500", "poster");
    const episodeStatsId = `tv_${Number(tvId)}_s${Number(seasonNumber)}e${Number(episodeNumber)}`;

    return (
        <main className="min-h-screen bg-background">
            <div className="relative w-full pt-16">
                <div className="absolute inset-0 bg-black">
                    <Image
                        src={bannerUrl}
                        alt={episode.name || "Episode"}
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
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-white/5">
                                <Image
                                    src={posterUrl}
                                    alt={episode.name || `Episode ${episodeNumber}`}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            {/* Series name as top-level context */}
                            <Link href={getShowUrl(tv)} className="text-accent hover:underline text-sm font-semibold uppercase tracking-wide">
                                {tv.name}
                            </Link>

                            {/* Season + Episode label */}
                            <div className="text-base text-textSecondary font-medium -mt-4">
                                Season {seasonNumber} · Episode {episodeNumber}
                            </div>

                            {/* Episode name as H1 */}
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg -mt-2">
                                {episode.name || `Episode ${episodeNumber}`}
                            </h1>

                            {/* Meta row: air date + runtime */}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-textSecondary">
                                {episode.air_date && (
                                    <span>{new Date(episode.air_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                                )}
                                {episode.air_date && episode.runtime && <span>·</span>}
                                {episode.runtime && (
                                    <span>{episode.runtime}m</span>
                                )}
                            </div>

                            {/* Description */}
                            {episode.overview ? (
                                <ExpandableText
                                    text={episode.overview}
                                    maxLines={4}
                                    className="text-base md:text-lg text-textSecondary leading-relaxed"
                                />
                            ) : null}

                            <ActionBar
                                mediaId={tvId}
                                mediaType="tv"
                                title={tv.name}
                                posterPath={tv.poster_path}
                                bannerPath={episodeBannerPath}
                                currentRating={0}
                                releaseYear={tv.first_air_date ? tv.first_air_date.slice(0, 4) : ""}
                                seasons={tv.seasons || []}
                                tvTargetType="episode"
                                tvSeasonNumber={seasonNumber}
                                tvEpisodeNumber={episodeNumber}
                                seasonEpisodeCounts={Object.fromEntries(
                                    (Array.isArray(tv.seasons) ? tv.seasons : [])
                                        .filter((s) => s?.season_number != null)
                                        .map((s) => [String(s.season_number), Number(s.episode_count || 0)])
                                )}
                                allowPosterCustomization={false}
                                allowBannerCustomization={true}
                                customizationMediaId={`${tvId}_s${seasonNumber}e${episodeNumber}`}
                                customizationMediaType="tv"
                                customizationBannerPath={episodeBannerPath}
                                bannerTmdbEndpoint={`tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/images`}
                                initialSeasonNumber={seasonNumber}
                                initialEpisodeNumber={episodeNumber}
                            />

                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href={backToSeasonHref}
                                    className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                                >
                                    Back to season
                                </Link>
                                <Link
                                    href={getShowUrl(tv)}
                                    className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                                >
                                    Back to show
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="site-container py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <RatingDistribution mediaId={tvId} mediaType="tv" statsId={episodeStatsId} />
                        {episode.vote_average > 0 && (
                            <div className="flex items-center gap-1.5 text-sm text-textSecondary">
                                <span className="text-accent">★</span>
                                <span className="font-semibold text-white tabular-nums">{Number(episode.vote_average).toFixed(1)}</span>
                                <span>/ 10</span>
                                <span className="text-xs opacity-60 ml-1">TMDB</span>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-8">
                        <SectionTabs
                            tabs={[
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
                            {activeTab === "reviews" && (
                                <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} tvTargetType="episode" tvSeasonNumber={seasonNumber} tvEpisodeNumber={episodeNumber} />
                            )}

                            {activeTab === "cast" && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Cast</h2>
                                    {episode.credits?.cast && episode.credits.cast.length > 0 ? (
                                        <CastGrid cast={episode.credits.cast} />
                                    ) : tv?.credits?.cast && tv.credits.cast.length > 0 ? (
                                        <>
                                            <p className="text-sm text-textSecondary mb-4">Showing series cast</p>
                                            <CastGrid cast={tv.credits.cast} />
                                        </>
                                    ) : (
                                        <p className="text-sm text-textSecondary">No cast information available for this episode.</p>
                                    )}
                                </section>
                            )}

                            {activeTab === "crew" && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Crew</h2>
                                    {episode.credits?.crew && episode.credits.crew.length > 0 ? (
                                        <CrewSection crew={episode.credits.crew} />
                                    ) : (
                                        <p className="text-sm text-textSecondary">No crew information available for this episode.</p>
                                    )}
                                </section>
                            )}

                            {activeTab === "production" && tv.production_companies && tv.production_companies.length > 0 && (
                                <ProductionSection productions={tv.production_companies} />
                            )}

                            {activeTab === "media" && (
                                <MediaSection title="Media" posters={[]} backdrops={episode.images?.stills || []} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
