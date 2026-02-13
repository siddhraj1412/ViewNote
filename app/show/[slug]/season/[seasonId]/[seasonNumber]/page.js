"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { parseSlugId, getShowUrl } from "@/lib/slugify";
import CastSlider from "@/components/CastSlider";
import CrewSection from "@/components/CrewSection";
import MediaSection from "@/components/MediaSection";
import ReviewsForMedia from "@/components/ReviewsForMedia";

export default function SeasonPage() {
    const params = useParams();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const seasonId = params.seasonId;
    const seasonNumber = Number(params.seasonNumber);

    const [tv, setTv] = useState(null);
    const [season, setSeason] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("episodes");

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

    const bannerUrl = tmdb.getBannerUrl(null, season.poster_path, null);
    const backToShow = getShowUrl(tv);

    return (
        <main className="min-h-screen bg-background">
            <div className="relative w-full pt-16">
                <div className="relative w-full">
                    <div className="relative aspect-[5/2] w-full">
                        <Image src={bannerUrl} alt={season.name || "Season"} fill className="object-contain" priority />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-background" />
                    </div>

                    <div className="container absolute inset-0 z-10 flex items-center">
                        <div className="w-full pt-10">
                            <div className="flex items-start justify-between gap-6">
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">{season.name || `Season ${seasonNumber}`}</h1>
                                    <div className="text-sm text-white/70 mt-2">{tv.name} • Season {seasonNumber}</div>
                                </div>
                                <Link
                                    href={`/show/${encodeURIComponent(rawSlug)}/season`}
                                    className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/10 text-white border-white/20 hover:bg-white/15"
                                >
                                    All seasons
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container py-12">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveTab("episodes")}
                            className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${activeTab === "episodes" ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-textSecondary border-white/10 hover:text-white"}`}
                        >
                            Episodes
                        </button>
                        <button
                            onClick={() => setActiveTab("cast")}
                            className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${activeTab === "cast" ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-textSecondary border-white/10 hover:text-white"}`}
                        >
                            Cast
                        </button>
                        <button
                            onClick={() => setActiveTab("crew")}
                            className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${activeTab === "crew" ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-textSecondary border-white/10 hover:text-white"}`}
                        >
                            Crew
                        </button>
                        <button
                            onClick={() => setActiveTab("reviews")}
                            className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${activeTab === "reviews" ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-textSecondary border-white/10 hover:text-white"}`}
                        >
                            Reviews
                        </button>
                        <button
                            onClick={() => setActiveTab("media")}
                            className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${activeTab === "media" ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-textSecondary border-white/10 hover:text-white"}`}
                        >
                            Media
                        </button>
                    </div>

                    <Link
                        href={backToShow}
                        className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back to show
                    </Link>
                </div>

                {activeTab === "episodes" && (
                    <section>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {episodes.map((ep) => {
                                const href = `/show/${encodeURIComponent(rawSlug)}/season/${seasonId}/${seasonNumber}/episode/${ep.episode_number}`;
                                return (
                                    <Link key={ep.id} href={href} className="block">
                                        <div className="bg-secondary rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all">
                                            <div className="text-sm font-semibold text-white">Episode {ep.episode_number}: {ep.name}</div>
                                            {ep.overview ? (
                                                <div className="text-sm text-textSecondary mt-2 line-clamp-3">{ep.overview}</div>
                                            ) : null}
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
                        <CastSlider cast={season.credits.cast} />
                    </section>
                )}

                {activeTab === "crew" && season.credits?.crew && season.credits.crew.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold mb-6">Crew</h2>
                        <CrewSection crew={season.credits.crew} />
                    </section>
                )}

                {activeTab === "reviews" && (
                    <ReviewsForMedia mediaId={tvId} mediaType="tv" title={tv.name} />
                )}

                {activeTab === "media" && (
                    <MediaSection title="Media" posters={season.images?.posters || []} backdrops={[]} />
                )}
            </div>
        </main>
    );
}
