"use client";

import { useEffect, useMemo, useState } from "react";
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
import StreamingAvailability from "@/components/StreamingAvailability";
import TmdbRatingBadge from "@/components/TmdbRatingBadge";
import { Calendar, Clock, Globe, Film, DollarSign, Award } from "lucide-react";
import ExpandableText from "@/components/ExpandableText";
import { useAuth } from "@/context/AuthContext";
import { useRatings } from "@/hooks/useRatings";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import { parseSlugId, getMovieUrl, getShowUrl } from "@/lib/slugify";

export default function MovieSlugPage() {
    const params = useParams();
    const router = useRouter();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: movieId } = parseSlugId(rawSlug);

    const [movie, setMovie] = useState(null);
    const [stronglyRelated, setStronglyRelated] = useState([]);
    const [similarFilter, setSimilarFilter] = useState("all");
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

        // Reset state when navigating between movies (React reuses component instance)
        setMovie(null);
        setStronglyRelated([]);
        setSimilarFilter("all");
        setMediaImages({ posters: [], backdrops: [] });
        setActiveTab("cast");
        setError(null);

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
                document.title = `${data.title} (${(data.release_date || '').split('-')[0]}) - ViewNote`;

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

    const similarItemsAll = useMemo(() => {
        return (Array.isArray(stronglyRelated) ? stronglyRelated : []).filter((r) => r && r.id).map((r) => ({
            ...r,
            media_type: r.media_type || "movie",
        }));
    }, [stronglyRelated]);

    const filteredSimilar = useMemo(() => {
        if (similarFilter === "all") return similarItemsAll;
        if (similarFilter === "movie") return similarItemsAll.filter((i) => (i.media_type || "movie") === "movie");
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
                                <ExpandableText
                                    text={movie.overview}
                                    maxLines={4}
                                    className="text-base md:text-lg text-textSecondary leading-relaxed"
                                />
                            )}

                            {Array.isArray(movie.production_countries) && movie.production_countries.length > 0 && (
                                <div className="text-sm text-textSecondary">
                                    Location: {movie.production_countries.map((c) => c?.name).filter(Boolean).join(", ")}
                                </div>
                            )}

                            <ActionBar
                                mediaId={movieId}
                                mediaType="movie"
                                title={movie.title}
                                posterPath={movie.poster_path}
                                currentRating={userRating}
                                releaseYear={movie.release_date ? movie.release_date.slice(0, 4) : ""}
                                customPoster={customPoster}
                                customBanner={customBanner}
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
                        <RatingDistribution mediaId={movieId} mediaType="movie" />
                        {movie.vote_average > 0 && (
                            <TmdbRatingBadge value={movie.vote_average} />
                        )}

                        {/* Movie Details / Metadata */}
                        <div className="space-y-2 text-sm text-textSecondary">
                            {(() => {
                                const usRelease = movie.release_dates?.results?.find(r => r.iso_3166_1 === "US");
                                const cert = usRelease?.release_dates?.find(d => d.certification)?.certification;
                                if (!cert) return null;
                                return (
                                    <div className="flex items-center gap-2">
                                        <Award size={14} className="text-accent shrink-0" />
                                        <span className="font-medium text-white px-1.5 py-0.5 border border-white/20 rounded text-xs">{cert}</span>
                                        <span className="text-xs opacity-60">Certification</span>
                                    </div>
                                );
                            })()}
                            {movie.runtime > 0 && (
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-accent shrink-0" />
                                    <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
                                </div>
                            )}
                            {movie.original_language && (
                                <div className="flex items-center gap-2">
                                    <Globe size={14} className="text-accent shrink-0" />
                                    <span>Original Language: {new Intl.DisplayNames(["en"], { type: "language" }).of(movie.original_language)}</span>
                                </div>
                            )}
                            {movie.budget > 0 && (
                                <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-accent shrink-0" />
                                    <span>Budget: ${movie.budget.toLocaleString()}</span>
                                </div>
                            )}
                            {movie.revenue > 0 && (
                                <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-accent shrink-0" />
                                    <span>Revenue: ${movie.revenue.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        <StreamingAvailability mediaType="movie" mediaId={movieId} />
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
                                { id: "similar", label: "Similar" },
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
                                <MediaSection
                                    title="Media"
                                    posters={mediaImages.posters}
                                    backdrops={mediaImages.backdrops}
                                    videos={movie.videos?.results || []}
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
                                                const isTv = related.media_type === "tv";
                                                const href = isTv ? getShowUrl(related) : getMovieUrl(related);
                                                const relatedTitle = related.title || related.name;
                                                const poster = related.poster_path;
                                                return (
                                                    <Link key={`${related.media_type || "movie"}_${related.id}`} href={href} className="group">
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
        </main>
    );
}
