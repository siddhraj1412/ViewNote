"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import ActionBar from "@/components/ActionBar";
import CastSlider from "@/components/CastSlider";
import CrewSection from "@/components/CrewSection";
import ProductionSection from "@/components/ProductionSection";
import { Calendar, Clock, Star, Tv } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRatings } from "@/hooks/useRatings";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";

export default function TVDetailsPage() {
    const params = useParams();
    const tvId = Number(params.id);
    const [tv, setTv] = useState(null);
    const [stronglyRelated, setStronglyRelated] = useState([]);
    const [loading, setLoading] = useState(true);

    const { user } = useAuth();
    const { getRating } = useRatings();
    const userRating = getRating(tvId);

    // Use live customization hook
    const { customPoster, customBanner } = useMediaCustomization(
        tvId,
        "tv",
        tv?.poster_path,
        tv?.backdrop_path
    );

    useEffect(() => {
        const fetchTV = async () => {
            try {
                const data = await tmdb.getTVDetails(tvId);
                setTv(data);

                // Fetch strongly related TV shows
                const related = await tmdb.getStronglyRelated(tvId, "tv", data);
                setStronglyRelated(related);
            } catch (error) {
                console.error("Error fetching TV show:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTV();
    }, [tvId]);

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

    const bannerUrl = tmdb.getBannerUrl(
        customBanner || tv.backdrop_path,
        tv.poster_path
    );
    const posterUrl = tmdb.getImageUrl(customPoster || tv.poster_path, "w500");

    return (
        <main className="min-h-screen bg-background">
            {/* Hero Section with Banner Background - Below Header */}
            <div className="relative w-full min-h-screen md:min-h-[600px] pt-16">
                {/* Banner Background */}
                <div className="absolute inset-0">
                    <Image
                        src={bannerUrl}
                        alt={tv.name}
                        fill
                        className="object-cover object-center"
                        priority
                        quality={90}
                    />
                    {/* Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
                </div>

                {/* Content - Poster + Info */}
                <div className="relative container mx-auto px-4 pt-24 md:pt-32 pb-12">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Left: Poster */}
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

                        {/* Right: Info */}
                        <div className="flex-1 space-y-6">
                            {/* Title */}
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg">
                                {tv.name}
                            </h1>

                            {/* Meta Information */}
                            <div className="flex flex-wrap items-center gap-4 text-base md:text-lg">
                                {tv.first_air_date && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={20} className="text-accent" />
                                        <span className="font-medium">
                                            {new Date(tv.first_air_date).getFullYear()}
                                        </span>
                                    </div>
                                )}
                                {tv.number_of_seasons && (
                                    <div className="flex items-center gap-2">
                                        <Tv size={20} className="text-accent" />
                                        <span className="font-medium">
                                            {tv.number_of_seasons} Season{tv.number_of_seasons > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )}
                                {tv.vote_average > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Star size={20} className="text-accent" fill="currentColor" />
                                        <span className="font-medium">{tv.vote_average.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Genres */}
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

                            {/* Overview */}
                            {tv.overview && (
                                <p className="text-base md:text-lg text-textSecondary leading-relaxed max-w-3xl">
                                    {tv.overview}
                                </p>
                            )}

                            {/* Action Bar */}
                            <ActionBar
                                mediaId={tvId}
                                mediaType="tv"
                                title={tv.name}
                                posterPath={tv.poster_path}
                                currentRating={userRating}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Sections */}
            <div className="container mx-auto px-4 py-12 space-y-16">
                {/* Cast */}
                {tv.credits?.cast && tv.credits.cast.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold mb-6">Cast</h2>
                        <CastSlider cast={tv.credits.cast} />
                    </section>
                )}

                {/* Crew */}
                {tv.credits?.crew && tv.credits.crew.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold mb-6">Crew</h2>
                        <CrewSection crew={tv.credits.crew} />
                    </section>
                )}

                {/* Production Companies */}
                {tv.production_companies && tv.production_companies.length > 0 && (
                    <ProductionSection productions={tv.production_companies} />
                )}

                {/* Strongly Related */}
                {stronglyRelated.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold mb-6">Strongly Related</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {stronglyRelated.map((related) => (
                                <Link key={related.id} href={`/tv/${related.id}`} className="group">
                                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-secondary">
                                        <Image
                                            src={tmdb.getImageUrl(related.poster_path)}
                                            alt={related.name}
                                            fill
                                            className="object-cover"
                                        />
                                        {related.similarityScore && (
                                            <div className="absolute top-2 right-2 bg-accent text-background px-2 py-1 rounded text-xs font-bold">
                                                {related.similarityScore}%
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-medium text-sm line-clamp-2">{related.name}</h3>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
