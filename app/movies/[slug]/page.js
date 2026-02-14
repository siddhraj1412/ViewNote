"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import ActionBar from "@/components/ActionBar";
import CastGrid from "@/components/CastGrid";
import CrewSection from "@/components/CrewSection";
import ProductionSection from "@/components/ProductionSection";
import RatingDistribution from "@/components/RatingDistribution";
import MediaSection from "@/components/MediaSection";
import ReviewsForMedia from "@/components/ReviewsForMedia";
import SectionTabs from "@/components/SectionTabs";
import { Calendar, Clock, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRatings } from "@/hooks/useRatings";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import { parseSlugId, getMovieUrl } from "@/lib/slugify";

export default function MovieSlugPage() {
    const params = useParams();
    const router = useRouter();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: movieId } = parseSlugId(rawSlug);

    const [movie, setMovie] = useState(null);
    const [stronglyRelated, setStronglyRelated] = useState([]);
    const [mediaImages, setMediaImages] = useState({ posters: [], backdrops: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("cast");

    const { user } = useAuth();
    const { getRating } = useRatings();
    const userRating = movieId ? getRating(movieId) : null;

    // Use live customization hook
    const { customPoster, customBanner } = useMediaCustomization(
        movieId,
        "movie",
        movie?.poster_path,
        movie?.backdrop_path
    );

    useEffect(() => {
        if (!movieId) {
            setLoading(false);
            return;
        }

        const fetchMovie = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await tmdb.getMovieDetails(movieId);
                if (!data) {
                    setError("Movie not found");
                    setLoading(false);
                    return;
                }
                setMovie(data);

                // Set page title for SEO
                document.title = `${data.title} (${(data.release_date || '').split('-')[0]}) — ViewNote`;

                // Verify URL slug matches the movie title, redirect if not
                const correctUrl = getMovieUrl(data);
                const currentPath = `/movies/${rawSlug}`;
                if (correctUrl !== currentPath) {
                    router.replace(correctUrl, { scroll: false });
                }

                // Fetch strongly related movies
                try {
                    const related = await tmdb.getStronglyRelated(movieId, "movie", data);
                    setStronglyRelated(related);
                } catch (e) {
                    console.warn("Failed to fetch related movies", e);
                }

                // Fetch images for Media section (single fetch)
                try {
                    const images = await tmdb.getMovieImages(movieId);
                    setMediaImages({ posters: images?.posters || [], backdrops: images?.backdrops || [] });
                } catch (_) {
                    setMediaImages({ posters: [], backdrops: [] });
                }
            } catch (error) {
                console.error("Error fetching movie:", error);
                setError(error.message || "Failed to load movie");
            } finally {
                setLoading(false);
            }
        };

        fetchMovie();
    }, [movieId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center pt-16 gap-4">
                <div className="text-2xl text-red-500">{error.includes("404") ? "Movie not found" : "Something went wrong"}</div>
                <p className="text-textSecondary">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!movie) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Movie not found</div>
            </div>
        );
    }

    const bannerUrl = tmdb.getBannerUrl(
        customBanner || movie.backdrop_path,
        movie.poster_path
    );
    const posterUrl = tmdb.getImageUrl(customPoster || movie.poster_path, "w500");

    return (
        <main className="min-h-screen bg-background">
            {/* Hero Section with Banner Background */}
            <div className="relative w-full pt-16 min-h-[calc(100vh-4rem)]">
                <div className="absolute inset-0 bg-black">
                    <Image
                        src={bannerUrl}
                        alt={movie.title}
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
                                    alt={movie.title}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg">
                                {movie.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-base md:text-lg">
                                {movie.release_date && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={20} className="text-accent" />
                                        <span className="font-medium">
                                            {new Date(movie.release_date).getFullYear()}
                                        </span>
                                    </div>
                                )}
                                {movie.runtime && (
                                    <div className="flex items-center gap-2">
                                        <Clock size={20} className="text-accent" />
                                        <span className="font-medium">
                                            {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                                        </span>
                                    </div>
                                )}
                                {movie.vote_average > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Star size={20} className="text-accent" fill="currentColor" />
                                        <span className="font-medium">{movie.vote_average.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>

                            {movie.genres && movie.genres.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {movie.genres.map((genre) => (
                                        <span
                                            key={genre.id}
                                            className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium"
                                        >
                                            {genre.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {movie.overview && (
                                <p className="text-base md:text-lg text-textSecondary leading-relaxed">
                                    {movie.overview}
                                </p>
                            )}

                            <ActionBar
                                mediaId={movieId}
                                mediaType="movie"
                                title={movie.title}
                                posterPath={movie.poster_path}
                                currentRating={userRating}
                                releaseYear={movie.release_date ? movie.release_date.slice(0, 4) : ""}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Sections */}
            <div className="site-container py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left column (below poster area) */}
                    <div className="lg:col-span-4 space-y-6">
                        <RatingDistribution mediaId={movieId} />
                    </div>

                    {/* Right column */}
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
                            {activeTab === "cast" && movie.credits?.cast && movie.credits.cast.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Cast</h2>
                                    <CastGrid cast={movie.credits.cast} />
                                </section>
                            )}

                            {activeTab === "crew" && movie.credits?.crew && movie.credits.crew.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Crew</h2>
                                    <CrewSection crew={movie.credits.crew} />
                                </section>
                            )}

                            {activeTab === "production" && movie.production_companies && movie.production_companies.length > 0 && (
                                <ProductionSection productions={movie.production_companies} />
                            )}

                            {activeTab === "reviews" && (
                                <ReviewsForMedia mediaId={movieId} mediaType="movie" title={movie.title} />
                            )}

                            {activeTab === "media" && (
                                <MediaSection title="Media" posters={mediaImages.posters} backdrops={mediaImages.backdrops} />
                            )}

                            {stronglyRelated.length > 0 && (
                                <section>
                                    <h2 className="text-3xl font-bold mb-6">Strongly Related</h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {stronglyRelated.map((related) => (
                                            <Link key={related.id} href={getMovieUrl(related)} className="group">
                                                <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-secondary">
                                                    <Image
                                                        src={tmdb.getImageUrl(related.poster_path)}
                                                        alt={related.title}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                    {related.similarityScore && (
                                                        <div className="absolute top-2 right-2 bg-accent text-background px-2 py-1 rounded text-xs font-bold">
                                                            {related.similarityScore}%
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className="font-medium text-sm line-clamp-2">{related.title}</h3>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
