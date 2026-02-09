"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import { Film, Tv } from "lucide-react";

export default function PersonPage() {
    const params = useParams();
    const personId = Number(params.id);
    const [person, setPerson] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPerson = async () => {
            try {
                const data = await tmdb.getPersonDetails(personId);
                setPerson(data);
            } catch (error) {
                console.error("Error fetching person:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPerson();
    }, [personId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Person not found</div>
            </div>
        );
    }

    const movies = person.movie_credits?.cast?.slice(0, 12) || [];
    const tvShows = person.tv_credits?.cast?.slice(0, 12) || [];

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12">
                <div className="flex flex-col md:flex-row gap-8 mb-12">
                    {/* Profile Image */}
                    <div className="flex-shrink-0">
                        <div className="relative w-64 aspect-[2/3] rounded-xl overflow-hidden">
                            <Image
                                src={tmdb.getImageUrl(person.profile_path)}
                                alt={person.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-5xl font-bold mb-4">{person.name}</h1>
                        <p className="text-xl text-accent mb-6">{person.known_for_department}</p>

                        {person.biography && (
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold mb-3">Biography</h2>
                                <p className="text-textSecondary leading-relaxed whitespace-pre-line">
                                    {person.biography}
                                </p>
                            </div>
                        )}

                        {person.birthday && (
                            <div className="mb-2">
                                <span className="text-textSecondary">Born: </span>
                                <span className="font-semibold">{person.birthday}</span>
                                {person.place_of_birth && (
                                    <span className="text-textSecondary"> in {person.place_of_birth}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Movies */}
                {movies.length > 0 && (
                    <section className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <Film className="text-accent" size={28} />
                            <h2 className="text-3xl font-bold">Known For (Movies)</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {movies.map((movie: any) => (
                                <Link
                                    key={movie.id}
                                    href={`/movie/${movie.id}`}
                                    className="group"
                                >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2">
                                        <Image
                                            src={tmdb.getImageUrl(movie.poster_path)}
                                            alt={movie.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform"
                                        />
                                    </div>
                                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition">
                                        {movie.title}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* TV Shows */}
                {tvShows.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-6">
                            <Tv className="text-accent" size={28} />
                            <h2 className="text-3xl font-bold">Known For (TV)</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {tvShows.map((show: any) => (
                                <Link
                                    key={show.id}
                                    href={`/tv/${show.id}`}
                                    className="group"
                                >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2">
                                        <Image
                                            src={tmdb.getImageUrl(show.poster_path)}
                                            alt={show.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform"
                                        />
                                    </div>
                                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition">
                                        {show.name}
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
