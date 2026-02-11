"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Play, TrendingUp, Tv } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
    const [trendingMovies, setTrendingMovies] = useState([]);
    const [trendingTV, setTrendingTV] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const [movies, tv] = await Promise.all([
                    tmdb.getTrendingMovies(),
                    tmdb.getTrendingTV(),
                ]);

                // Shuffle for random discovery
                const shuffle = (arr) => {
                    const shuffled = [...arr];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    return shuffled;
                };

                setTrendingMovies(shuffle(movies).slice(0, 10));
                setTrendingTV(shuffle(tv).slice(0, 10));
            } catch (error) {
                console.error("Error fetching trending content:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrending();
    }, []);

    // Random spotlight from trending movies (changes on refresh)
    const featuredMovie =
        trendingMovies.length > 0
            ? trendingMovies[Math.floor(Math.random() * Math.min(5, trendingMovies.length))]
            : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Hero Section - Random Spotlight */}
            {featuredMovie && (
                <section className="relative h-[80vh] w-full overflow-hidden">
                    <div className="absolute inset-0">
                        <Image
                            src={tmdb.getBannerUrl(
                                featuredMovie.backdrop_path,
                                featuredMovie.poster_path
                            )}
                            alt={featuredMovie.title || "Featured content"}
                            fill
                            className="object-cover"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    </div>

                    <div className="container mx-auto px-4 h-full flex flex-col justify-end pb-20 relative z-10">
                        <div className="max-w-2xl">
                            <h1 className="text-4xl md:text-6xl font-bold mb-4">
                                {featuredMovie.title}
                            </h1>
                            <p className="text-lg md:text-xl text-textSecondary mb-8 line-clamp-3">
                                {featuredMovie.overview}
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link href={`/movie/${featuredMovie.id}`}>
                                    <Button size="lg">
                                        <Play className="mr-2 fill-current" size={20} />
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Trending Movies Section */}
            <section className="container mx-auto px-4 py-16">
                <div className="flex items-center gap-3 mb-8">
                    <TrendingUp className="text-accent" size={32} />
                    <h2 className="text-3xl md:text-4xl font-bold">Trending Movies</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                    {trendingMovies.map((movie) => (
                        <Link key={movie.id} href={`/movie/${movie.id}`} className="group">
                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow duration-300">
                                <Image
                                    src={tmdb.getImageUrl(movie.poster_path)}
                                    alt={movie.title || "Movie poster"}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="text-base md:text-lg font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                                {movie.title}
                            </h3>
                            <div className="flex items-center gap-2 text-textSecondary text-sm">
                                <span>{movie.release_date?.split("-")[0]}</span>
                                <span>•</span>
                                <span className="text-accent font-bold">
                                    ★ {movie.vote_average?.toFixed(1)}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Trending TV Shows Section */}
            <section className="container mx-auto px-4 py-16">
                <div className="flex items-center gap-3 mb-8">
                    <Tv className="text-accent" size={32} />
                    <h2 className="text-3xl md:text-4xl font-bold">Trending TV Shows</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                    {trendingTV.map((show) => (
                        <Link key={show.id} href={`/tv/${show.id}`} className="group">
                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow duration-300">
                                <Image
                                    src={tmdb.getImageUrl(show.poster_path)}
                                    alt={show.name || "TV show poster"}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="text-base md:text-lg font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                                {show.name}
                            </h3>
                            <div className="flex items-center gap-2 text-textSecondary text-sm">
                                <span>{show.first_air_date?.split("-")[0]}</span>
                                <span>•</span>
                                <span className="text-accent font-bold">
                                    ★ {show.vote_average?.toFixed(1)}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* CTA Section - Only for non-logged-in users */}
            {!user && (
                <section className="container mx-auto px-4 py-16">
                    <div className="bg-secondary rounded-2xl p-8 md:p-12 text-center border border-white/5">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Watch blind. Rate honestly.
                        </h2>
                        <p className="text-lg md:text-xl text-textSecondary mb-8 max-w-2xl mx-auto">
                            Track your movies and series without spoilers. Build your personal
                            journal and discover what's truly worth your time.
                        </p>
                        <Link href="/signup">
                            <Button size="lg">Get Started Free</Button>
                        </Link>
                    </div>
                </section>
            )}
        </main>
    );
}
