"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { tmdb, Movie, TVShow } from "@/lib/tmdb";
import { Film, Tv } from "lucide-react";

export default function SearchResultsPage() {
    const searchParams = useSearchParams();
    const query = searchParams.get("q") || "";
    const [movies, setMovies] = useState<Movie[]>([]);
    const [tvShows, setTVShows] = useState<TVShow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"movies" | "tv">("movies");

    useEffect(() => {
        const fetchResults = async () => {
            if (!query) return;
            setLoading(true);

            try {
                const [movieResults, tvResults] = await Promise.all([
                    tmdb.searchMovies(query),
                    tmdb.searchTV(query),
                ]);
                setMovies(movieResults);
                setTVShows(tvResults);
            } catch (error) {
                console.error("Error searching:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query]);

    const results = activeTab === "movies" ? movies : tvShows;

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-2">Search Results</h1>
                <p className="text-textSecondary mb-8">
                    Showing results for "{query}"
                </p>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-secondary">
                    <button
                        onClick={() => setActiveTab("movies")}
                        className={`pb-4 px-2 flex items-center gap-2 transition ${activeTab === "movies"
                                ? "border-b-2 border-accent text-accent"
                                : "text-textSecondary hover:text-textPrimary"
                            }`}
                    >
                        <Film size={20} />
                        Movies ({movies.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("tv")}
                        className={`pb-4 px-2 flex items-center gap-2 transition ${activeTab === "tv"
                                ? "border-b-2 border-accent text-accent"
                                : "text-textSecondary hover:text-textPrimary"
                            }`}
                    >
                        <Tv size={20} />
                        TV Shows ({tvShows.length})
                    </button>
                </div>

                {/* Results Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="bg-secondary rounded-xl h-80 animate-pulse" />
                        ))}
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-xl text-textSecondary">No results found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {results.map((item: any) => (
                            <Link
                                key={item.id}
                                href={`/${activeTab === "movies" ? "movie" : "tv"}/${item.id}`}
                                className="group cursor-pointer"
                            >
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3">
                                    <Image
                                        src={tmdb.getImageUrl(item.poster_path)}
                                        alt={item.title || item.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                                <h3 className="font-semibold line-clamp-2 group-hover:text-accent transition">
                                    {item.title || item.name}
                                </h3>
                                <p className="text-sm text-textSecondary">
                                    {(item.release_date || item.first_air_date)?.split("-")[0] || "N/A"}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
