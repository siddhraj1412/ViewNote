"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Play, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
    const [trendingMovies, setTrendingMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const movies = await tmdb.getTrendingMovies();
                setTrendingMovies(movies.slice(0, 10));
            } catch (error) {
                console.error("Error fetching trending movies:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrending();
    }, []);

    const featuredMovie = trendingMovies[0];

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Hero Section */}
            {featuredMovie && (
                <section className="relative h-[80vh] w-full overflow-hidden">
                    <div className="absolute inset-0">
                        <Image
                            src={tmdb.getImageUrl(featuredMovie.backdrop_path, "original")}
                            alt={featuredMovie.title}
                            fill
                            className="object-cover"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    </div>

                    <div className="container mx-auto px-4 h-full flex flex-col justify-end pb-20 relative z-10">
                        <div className="max-w-2xl">
                            <h1 className="text-6xl font-bold mb-4">{featuredMovie.title}</h1>
                            <p className="text-xl text-textSecondary mb-8 line-clamp-3">
                                {featuredMovie.overview}
                            </p>
                            <div className="flex gap-4">
                                <Link href={`/movie/${featuredMovie.id}`}>
                                    <Button size="lg">
                                        <Play className="mr-2 fill-current" size={20} />
                                        View Details
                                    </Button>
                                </Link>
                                <Button variant="secondary" size="lg">
                                    Add to Watchlist
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Trending Section */}
            <section className="container mx-auto px-4 py-16">
                <div className="flex items-center gap-3 mb-8">
                    <TrendingUp className="text-accent" size={32} />
                    <h2 className="text-4xl font-bold">Trending This Week</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    {trendingMovies.map((movie) => (
                        <Link key={movie.id} href={`/movie/${movie.id}`} className="group">
                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 shadow-lg group-hover:scale-105 transition-transform duration-300">
                                <Image
                                    src={tmdb.getImageUrl(movie.poster_path)}
                                    alt={movie.title}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="text-lg font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                                {movie.title}
                            </h3>
                            <div className="flex items-center gap-2 text-textSecondary text-sm">
                                <span>{movie.release_date?.split("-")[0]}</span>
                                <span>•</span>
                                <span className="text-accent font-bold">★ {movie.vote_average?.toFixed(1)}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            {!user && (
                <section className="container mx-auto px-4 py-16">
                    <div className="bg-secondary rounded-2xl p-12 text-center border border-white/5">
                        <h2 className="text-4xl font-bold mb-4">Watch blind. Rate honestly.</h2>
                        <p className="text-xl text-textSecondary mb-8 max-w-2xl mx-auto">
                            Track your movies and series without spoilers. Build your personal journal and
                            discover what's truly worth your time.
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
