"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { parseSlugId, getShowUrl } from "@/lib/slugify";
import CastGrid from "@/components/CastGrid";
import CrewSection from "@/components/CrewSection";
import ProductionSection from "@/components/ProductionSection";
import MediaSection from "@/components/MediaSection";
import ReviewsForMedia from "@/components/ReviewsForMedia";
import SectionTabs from "@/components/SectionTabs";

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
    const [activeTab, setActiveTab] = useState("reviews");

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

    const bannerUrl = tmdb.getBannerUrl(null, episode.still_path, null);

    return (
        <main className="min-h-screen bg-background">
            <div className="relative w-full pt-16">
                <div className="relative w-full min-h-[420px] md:min-h-[520px]">
                    <Image src={bannerUrl} alt={episode.name || "Episode"} fill className="object-contain" priority />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-background" />
                </div>

                <div className="site-container absolute inset-0 z-10 flex items-center">
                    <div className="w-full pt-10">
                        <div className="flex items-start justify-between gap-6">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">Episode {episodeNumber}: {episode.name}</h1>
                                <div className="text-sm text-white/70 mt-2">{tv.name} • Season {seasonNumber}</div>
                            </div>
                            <Link
                                href={backToSeasonHref}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/10 text-white border-white/20 hover:bg-white/15"
                            >
                                Back to season
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="site-container py-12">
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
                    rightSlot={
                        <Link
                            href={getShowUrl(tv)}
                            className="px-6 py-3 rounded-xl text-base font-semibold border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                        >
                            Back to show
                        </Link>
                    }
                />

                {activeTab === "reviews" && (
                    <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} />
                )}

                {activeTab === "cast" && episode.credits?.cast && episode.credits.cast.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold mb-6">Cast</h2>
                        <CastGrid cast={episode.credits.cast} />
                    </section>
                )}

                {activeTab === "crew" && episode.credits?.crew && episode.credits.crew.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold mb-6">Crew</h2>
                        <CrewSection crew={episode.credits.crew} />
                    </section>
                )}

                {activeTab === "production" && tv.production_companies && tv.production_companies.length > 0 && (
                    <ProductionSection productions={tv.production_companies} />
                )}

                {activeTab === "media" && (
                    <MediaSection title="Media" posters={[]} backdrops={episode.images?.stills || []} />
                )}
            </div>
        </main>
    );
}
