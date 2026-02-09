"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { tmdb, Movie } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Play, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
    const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const movies = await tmdb.getTrendingMovies("week");
                setTrendingMovies(movies.slice(0, 10));
            } catch (error) {
                console.error("Error fetching trending movies:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const heroMovie = trendingMovies[0];

    return (
        <main className="min-h-screen bg-background">
            {/* Hero Section */}
            {heroMovie && (
                <div className="relative h-[70vh] overflow-hidden">
                    <div className="absolute inset-0">
                        <Image
                            src={tmdb.getImageUrl(heroMovie.backdrop_path, "original")}
                            alt={heroMovie.title}
                            fill
                            className="object-cover"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    </div>

                    <div className="relative container mx-auto px-4 h-full flex items-end pb-16">
                        <div className="max-w-2xl">
                            <h1 className="text-5xl md:text-6xl font-bold mb-4">{heroMovie.title}</h1>
                            <p className="text-lg text-textSecondary mb-6 line-clamp-3">
                                {heroMovie.overview}
                            </p>
                            <div className="flex gap-4">
                                <Link href={`/movie/${heroMovie.id}`}>
                                    <Button size="lg">
                                        <Play className="mr-2" size={20} />
                                        View Details
                                    </Button>
                                </Link>
                                <Link href="/search">
                                    <Button variant="secondary" size="lg">
                                        Explore More
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trending Section */}
            <section className="container mx-auto px-4 py-12">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="text-accent" size={28} />
                    <h2 className="text-3xl font-bold">Trending This Week</h2>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="bg-secondary rounded-xl h-80 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {trendingMovies.map((movie) => (
                            <Link
                                key={movie.id}
                                href={`/movie/${movie.id}`}
                                className="group cursor-pointer"
                            >
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3">
                                    <Image
                                        src={tmdb.getImageUrl(movie.poster_path)}
                                        alt={movie.title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <h3 className="font-semibold line-clamp-2 group-hover:text-accent transition">
                                    {movie.title}
                                </h3>
                                <p className="text-sm text-textSecondary">
                                    {movie.release_date?.split("-")[0] || "N/A"}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* CTA Section */}
            <section className="container mx-auto px-4 py-16">
                <div className="bg-secondary rounded-2xl p-12 text-center">
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
        </main>
    );
}
