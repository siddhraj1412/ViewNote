"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import { Calendar, MapPin, Film } from "lucide-react";

export default function PersonDetailsPage() {
    const params = useParams();
    const personId = Number(params.id);
    const [person, setPerson] = useState(null);
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

    const filmography = person.combined_credits?.cast
        ?.sort((a, b) => (b.release_date || b.first_air_date || "").localeCompare(a.release_date || a.first_air_date || ""))
        .slice(0, 20) || [];

    return (
        <main className="min-h-screen bg-background py-16">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row gap-12">
                    {/* Sidebar */}
                    <div className="w-full md:w-1/3 flex flex-col items-center text-center">
                        <div className="relative w-64 aspect-square rounded-full overflow-hidden mb-8 border-4 border-accent/20">
                            <Image
                                src={tmdb.getImageUrl(person.profile_path, "h632")}
                                alt={person.name}
                                fill
                                className="object-cover"
                            />
                        </div>

                        <h1 className="text-4xl font-bold mb-6">{person.name}</h1>

                        <div className="space-y-4 text-textSecondary">
                            {person.birthday && (
                                <div className="flex items-center justify-center gap-2">
                                    <Calendar size={18} />
                                    <span>Born: {person.birthday}</span>
                                </div>
                            )}
                            {person.place_of_birth && (
                                <div className="flex items-center justify-center gap-2">
                                    <MapPin size={18} />
                                    <span>{person.place_of_birth}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="w-full md:w-2/3">
                        <section className="mb-12">
                            <h2 className="text-2xl font-bold mb-4">Biography</h2>
                            <p className="text-textSecondary leading-relaxed whitespace-pre-wrap">
                                {person.biography || "No biography available."}
                            </p>
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-6">
                                <Film className="text-accent" size={24} />
                                <h2 className="text-2xl font-bold">Filmography</h2>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                                {filmography.map((item) => (
                                    <Link
                                        key={`${item.media_type}-${item.id}`}
                                        href={`/${item.media_type}/${item.id}`}
                                        className="group"
                                    >
                                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 group-hover:scale-105 transition-transform duration-300">
                                            <Image
                                                src={tmdb.getImageUrl(item.poster_path)}
                                                alt={item.title || item.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <p className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition">
                                            {item.title || item.name}
                                        </p>
                                        <p className="text-xs text-textSecondary">
                                            {item.character}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
