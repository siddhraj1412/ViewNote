"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import { Film, Tv, Calendar, MapPin, User } from "lucide-react";

export default function PersonPage() {
    const params = useParams();
    const [person, setPerson] = useState(null);
    const [credits, setCredits] = useState({
        moviesActing: [],
        moviesCrew: [],
        tvActing: [],
        tvCrew: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPersonData = async () => {
            try {
                setLoading(true);
                const [personData, creditsData] = await Promise.all([
                    tmdb.getPersonDetails(params.id),
                    tmdb.getPersonCredits(params.id),
                ]);

                setPerson(personData);

                // Separate and sort all credits
                const moviesActing = (creditsData.cast || [])
                    .filter((c) => c.media_type === "movie")
                    .sort((a, b) => {
                        const dateA = a.release_date || "0000";
                        const dateB = b.release_date || "0000";
                        return dateB.localeCompare(dateA);
                    });

                const moviesCrew = (creditsData.crew || [])
                    .filter((c) => c.media_type === "movie")
                    .sort((a, b) => {
                        const dateA = a.release_date || "0000";
                        const dateB = b.release_date || "0000";
                        return dateB.localeCompare(dateA);
                    });

                // Group movie crew by department
                const moviesCrewByDept = moviesCrew.reduce((acc, credit) => {
                    const dept = credit.department || "Other";
                    if (!acc[dept]) {
                        acc[dept] = [];
                    }
                    acc[dept].push(credit);
                    return acc;
                }, {});

                const tvActing = (creditsData.cast || [])
                    .filter((c) => c.media_type === "tv")
                    .sort((a, b) => {
                        const dateA = a.first_air_date || "0000";
                        const dateB = b.first_air_date || "0000";
                        return dateB.localeCompare(dateA);
                    });

                const tvCrew = (creditsData.crew || [])
                    .filter((c) => c.media_type === "tv")
                    .sort((a, b) => {
                        const dateA = a.first_air_date || "0000";
                        const dateB = b.first_air_date || "0000";
                        return dateB.localeCompare(dateA);
                    });

                // Group TV crew by department
                const tvCrewByDept = tvCrew.reduce((acc, credit) => {
                    const dept = credit.department || "Other";
                    if (!acc[dept]) {
                        acc[dept] = [];
                    }
                    acc[dept].push(credit);
                    return acc;
                }, {});

                setCredits({
                    moviesActing,
                    moviesCrew: moviesCrewByDept,
                    tvActing,
                    tvCrew: tvCrewByDept,
                });
            } catch (error) {
                console.error("Error fetching person data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchPersonData();
        }
    }, [params.id]);

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

    const CreditGrid = ({ items, mediaType }) => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item, index) => (
                <Link
                    key={`${item.id}-${index}`}
                    href={`/${mediaType}/${item.id}`}
                    className="group"
                >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-secondary">
                        <Image
                            src={tmdb.getImageUrl(item.poster_path)}
                            alt={item.title || item.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                        />
                    </div>
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">
                        {item.title || item.name}
                    </h3>
                    {item.character && (
                        <p className="text-xs text-textSecondary line-clamp-1">
                            as {item.character}
                        </p>
                    )}
                    {item.job && (
                        <p className="text-xs text-textSecondary line-clamp-1">
                            {item.job}
                        </p>
                    )}
                    {(item.release_date || item.first_air_date) && (
                        <p className="text-xs text-textSecondary">
                            {new Date(
                                item.release_date || item.first_air_date
                            ).getFullYear()}
                        </p>
                    )}
                </Link>
            ))}
        </div>
    );

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Person Info */}
                    <div className="lg:col-span-1">
                        <div className="lg:sticky lg:top-24 space-y-6">
                            {/* Profile Image */}
                            <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden">
                                <Image
                                    src={tmdb.getImageUrl(person.profile_path, "w500", "profile")}
                                    alt={person.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>

                            {/* Name */}
                            <h1 className="text-3xl font-bold">{person.name}</h1>

                            {/* Biography */}
                            {person.biography && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-2 text-accent">
                                        Biography
                                    </h2>
                                    <p className="text-textSecondary leading-relaxed text-sm">
                                        {person.biography}
                                    </p>
                                </div>
                            )}

                            {/* Personal Info */}
                            <div className="space-y-4">
                                {person.birthday && (
                                    <div className="flex items-start gap-3">
                                        <Calendar className="text-accent mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-textSecondary">Born</p>
                                            <p className="font-medium">
                                                {new Date(person.birthday).toLocaleDateString("en-US", {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {person.place_of_birth && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="text-accent mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-textSecondary">
                                                Place of Birth
                                            </p>
                                            <p className="font-medium">{person.place_of_birth}</p>
                                        </div>
                                    </div>
                                )}

                                {person.known_for_department && (
                                    <div className="flex items-start gap-3">
                                        <User className="text-accent mt-1" size={20} />
                                        <div>
                                            <p className="text-sm text-textSecondary">Known For</p>
                                            <p className="font-medium">
                                                {person.known_for_department}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Credits */}
                    <div className="lg:col-span-2 space-y-12">
                        {/* Movies - Acting */}
                        {credits.moviesActing.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-6">
                                    <Film className="text-accent" size={28} />
                                    <h2 className="text-3xl font-bold">Movies - Acting</h2>
                                </div>
                                <CreditGrid items={credits.moviesActing} mediaType="movie" />
                            </section>
                        )}

                        {/* Movies - Crew */}
                        {Object.keys(credits.moviesCrew).length > 0 && (
                            <section className="space-y-8">
                                {["Directing", "Writing", "Production", "Camera", "Sound", "Editing"].map(
                                    (dept) =>
                                        credits.moviesCrew?.[dept] && (
                                            <div key={dept}>
                                                <div className="flex items-center gap-2 mb-6">
                                                    <Film className="text-accent" size={28} />
                                                    <h2 className="text-3xl font-bold">
                                                        Movies - As {dept === "Directing" ? "Director" : dept === "Writing" ? "Writer" : dept}
                                                    </h2>
                                                </div>
                                                <CreditGrid
                                                    items={credits.moviesCrew[dept]}
                                                    mediaType="movie"
                                                />
                                            </div>
                                        )
                                )}
                                {/* Other departments */}
                                {Object.keys(credits.moviesCrew)
                                    .filter(
                                        (dept) =>
                                            !["Directing", "Writing", "Production", "Camera", "Sound", "Editing"].includes(dept)
                                    )
                                    .sort()
                                    .map((dept) => (
                                        <div key={dept}>
                                            <div className="flex items-center gap-2 mb-6">
                                                <Film className="text-accent" size={28} />
                                                <h2 className="text-3xl font-bold">
                                                    Movies - As {dept}
                                                </h2>
                                            </div>
                                            <CreditGrid
                                                items={credits.moviesCrew[dept]}
                                                mediaType="movie"
                                            />
                                        </div>
                                    ))}
                            </section>
                        )}

                        {/* TV - Acting */}
                        {credits.tvActing.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-6">
                                    <Tv className="text-accent" size={28} />
                                    <h2 className="text-3xl font-bold">TV Shows - Acting</h2>
                                </div>
                                <CreditGrid items={credits.tvActing} mediaType="tv" />
                            </section>
                        )}

                        {/* TV - Crew */}
                        {Object.keys(credits.tvCrew).length > 0 && (
                            <section className="space-y-8">
                                {["Directing", "Writing", "Production", "Camera", "Sound", "Editing"].map(
                                    (dept) =>
                                        credits.tvCrew[dept] && (
                                            <div key={dept}>
                                                <div className="flex items-center gap-2 mb-6">
                                                    <Tv className="text-accent" size={28} />
                                                    <h2 className="text-3xl font-bold">
                                                        TV Shows - As {dept === "Directing" ? "Director" : dept === "Writing" ? "Writer" : dept}
                                                    </h2>
                                                </div>
                                                <CreditGrid
                                                    items={credits.tvCrew[dept]}
                                                    mediaType="tv"
                                                />
                                            </div>
                                        )
                                )}
                                {/* Other departments */}
                                {Object.keys(credits.tvCrew)
                                    .filter(
                                        (dept) =>
                                            !["Directing", "Writing", "Production", "Camera", "Sound", "Editing"].includes(dept)
                                    )
                                    .sort()
                                    .map((dept) => (
                                        <div key={dept}>
                                            <div className="flex items-center gap-2 mb-6">
                                                <Tv className="text-accent" size={28} />
                                                <h2 className="text-3xl font-bold">
                                                    TV Shows - As {dept}
                                                </h2>
                                            </div>
                                            <CreditGrid
                                                items={credits.tvCrew[dept]}
                                                mediaType="tv"
                                            />
                                        </div>
                                    ))}
                            </section>
                        )}

                        {/* Empty State */}
                        {credits.moviesActing.length === 0 &&
                            Object.keys(credits.moviesCrew).length === 0 &&
                            credits.tvActing.length === 0 &&
                            Object.keys(credits.tvCrew).length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-textSecondary text-lg">
                                        No credits available for this person.
                                    </p>
                                </div>
                            )}
                    </div>
                </div>
            </div>
        </main>
    );
}
