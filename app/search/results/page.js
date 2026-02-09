"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import { MovieCardSkeleton } from "@/components/SkeletonLoader";

function ResultsContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get("q");
    const [results, setResults] = useState({ movies: [], tv: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("movies");

    useEffect(() => {
        if (!query) return;

        const fetchResults = async () => {
            setLoading(true);
            try {
                const [movies, tv] = await Promise.all([
                    tmdb.searchMovies(query),
                    tmdb.searchTV(query),
                ]);
                setResults({ movies, tv });
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query]);

    if (!query) return <div className="text-center py-20">No search term provided.</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">
                Results for <span className="text-accent">"{query}"</span>
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setActiveTab("movies")}
                    className={`px-6 py-2 rounded-full font-bold transition ${activeTab === "movies" ? "bg-accent text-background" : "bg-secondary text-textSecondary"
                        }`}
                >
                    Movies ({results.movies.length})
                </button>
                <button
                    onClick={() => setActiveTab("tv")}
                    className={`px-6 py-2 rounded-full font-bold transition ${activeTab === "tv" ? "bg-accent text-background" : "bg-secondary text-textSecondary"
                        }`}
                >
                    TV Shows ({results.tv.length})
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    {[...Array(10)].map((_, i) => <MovieCardSkeleton key={i} />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    {(activeTab === "movies" ? results.movies : results.tv).map((item) => (
                        <Link key={item.id} href={`/${activeTab === "movies" ? "movie" : "tv"}/${item.id}`} className="group">
                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 shadow-lg group-hover:scale-105 transition-transform duration-300">
                                <Image
                                    src={tmdb.getImageUrl(item.poster_path)}
                                    alt={item.title || item.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="text-lg font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                                {item.title || item.name}
                            </h3>
                            <div className="flex items-center gap-2 text-textSecondary text-sm">
                                <span>{(item.release_date || item.first_air_date || "").split("-")[0]}</span>
                                <span>•</span>
                                <span className="text-accent font-bold">★ {item.vote_average?.toFixed(1)}</span>
                            </div>
                        </Link>
                    ))}
                    {(activeTab === "movies" ? results.movies : results.tv).length === 0 && (
                        <div className="col-span-full py-20 text-center text-textSecondary">
                            No results found for this category.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SearchResultsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResultsContent />
        </Suspense>
    );
}
