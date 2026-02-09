"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import { Star, Plus, Check, Calendar, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function MovieDetailsPage() {
    const params = useParams();
    const movieId = Number(params.id);
    const [movie, setMovie] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchMovie = async () => {
            try {
                const data = await tmdb.getMovieDetails(movieId);
                setMovie(data);
            } catch (error) {
                console.error("Error fetching movie:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMovie();
    }, [movieId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!movie) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Movie not found</div>
            </div>
        );
    }

    const director = movie.credits?.crew?.find((person: any) => person.job === "Director");
    const cast = movie.credits?.cast?.slice(0, 10) || [];

    return (
        <main className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="relative h-[60vh] overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src={tmdb.getImageUrl(movie.backdrop_path, "original")}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 -mt-40 relative z-10">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Poster */}
                    <div className="flex-shrink-0">
                        <div className="relative w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                            <Image
                                src={tmdb.getImageUrl(movie.poster_path)}
                                alt={movie.title}
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-5xl font-bold mb-4">{movie.title}</h1>

                        <div className="flex flex-wrap items-center gap-4 text-textSecondary mb-6">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} />
                                <span>{movie.release_date?.split("-")[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={18} />
                                <span>{movie.runtime} min</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-accent" fill="currentColor" />
                                <span>{movie.vote_average?.toFixed(1)}/10</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {movie.genres?.map((genre: any) => (
                                <span
                                    key={genre.id}
                                    className="bg-secondary px-3 py-1 rounded-full text-sm"
                                >
                                    {genre.name}
                                </span>
                            ))}
                        </div>

                        {user && (
                            <div className="flex gap-4 mb-8">
                                <Button>
                                    <Plus size={18} className="mr-2" />
                                    Add to Watchlist
                                </Button>
                                <Button variant="secondary">
                                    <Star size={18} className="mr-2" />
                                    Rate
                                </Button>
                            </div>
                        )}

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold mb-3">Overview</h2>
                            <p className="text-textSecondary leading-relaxed">{movie.overview}</p>
                        </div>

                        {director && (
                            <div className="mb-4">
                                <span className="text-textSecondary">Directed by: </span>
                                <span className="font-semibold">{director.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cast */}
                {cast.length > 0 && (
                    <section className="mt-12">
                        <h2 className="text-3xl font-bold mb-6">Cast</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
                            {cast.map((person: any) => (
                                <Link
                                    key={person.id}
                                    href={`/person/${person.id}`}
                                    className="group text-center"
                                >
                                    <div className="relative aspect-square rounded-full overflow-hidden mb-2">
                                        <Image
                                            src={tmdb.getImageUrl(person.profile_path, "w200")}
                                            alt={person.name}
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform"
                                        />
                                    </div>
                                    <p className="font-semibold text-sm line-clamp-1 group-hover:text-accent transition">
                                        {person.name}
                                    </p>
                                    <p className="text-xs text-textSecondary line-clamp-1">
                                        {person.character}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
