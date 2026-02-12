"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Film, Tv, User } from "lucide-react";
import { tmdb } from "@/lib/tmdb";
import { getMovieUrl, getShowUrl, getPersonUrl } from "@/lib/slugify";

export default function SearchOverlay({ isOpen, onClose }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [popularResults, setPopularResults] = useState([]);
    const inputRef = useRef(null);
    const router = useRouter();

    // Fetch popular results on mount
    useEffect(() => {
        const fetchPopular = async () => {
            try {
                const [movies, tv] = await Promise.all([
                    tmdb.getTrendingMovies(),
                    tmdb.getTrendingTV(),
                ]);
                setPopularResults([
                    ...movies.slice(0, 5).map((m) => ({ ...m, media_type: "movie" })),
                    ...tv.slice(0, 5).map((t) => ({ ...t, media_type: "tv" })),
                ]);
            } catch (error) {
                console.error("Error fetching popular:", error);
            }
        };
        fetchPopular();
    }, []);

    // Focus input when opened and clear previous query
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setQuery(""); // Clear input when reopening
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await tmdb.searchMulti(query);
                setResults(data.results.slice(0, 10));
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    const handleResultClick = (result) => {
        const path =
            result.media_type === "movie"
                ? getMovieUrl(result)
                : result.media_type === "tv"
                    ? getShowUrl(result)
                    : getPersonUrl(result);
        router.push(path);
        onClose();
    };

    const getResultTitle = (result) => {
        return result.title || result.name;
    };

    const getResultIcon = (type) => {
        switch (type) {
            case "movie":
                return <Film size={16} className="text-accent" />;
            case "tv":
                return <Tv size={16} className="text-accent" />;
            case "person":
                return <User size={16} className="text-accent" />;
            default:
                return null;
        }
    };

    if (!isOpen) return null;

    const displayResults = query.trim() ? results : popularResults;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Search Panel */}
            <div className="fixed top-0 left-0 right-0 z-50 max-w-3xl mx-auto p-4">
                <div className="bg-secondary border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/10">
                        <Search size={20} className="text-textSecondary" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search movies, TV shows, people..."
                            className="flex-1 bg-transparent outline-none text-lg"
                        />
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-lg transition"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {loading && (
                            <div className="p-8 text-center text-textSecondary">
                                Searching...
                            </div>
                        )}

                        {!loading && displayResults.length === 0 && query.trim() && (
                            <div className="p-8 text-center text-textSecondary">
                                No results found
                            </div>
                        )}

                        {!loading && displayResults.length === 0 && !query.trim() && (
                            <div className="p-4">
                                <p className="text-sm text-textSecondary mb-3 px-2">
                                    Popular Now
                                </p>
                            </div>
                        )}

                        {!loading && displayResults.length > 0 && (
                            <div className="p-2">
                                {!query.trim() && (
                                    <p className="text-sm text-textSecondary mb-2 px-2">
                                        Popular Now
                                    </p>
                                )}
                                {displayResults.map((result) => (
                                    <button
                                        key={`${result.media_type}-${result.id}`}
                                        onClick={() => handleResultClick(result)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition text-left"
                                    >
                                        {/* Poster/Profile */}
                                        <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-background">
                                            <Image
                                                src={tmdb.getImageUrl(
                                                    result.poster_path || result.profile_path,
                                                    "w92",
                                                    result.media_type === "person" ? "profile" : "poster"
                                                )}
                                                alt={getResultTitle(result)}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getResultIcon(result.media_type)}
                                                <h3 className="font-medium truncate">
                                                    {getResultTitle(result)}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-textSecondary truncate">
                                                {result.media_type === "person"
                                                    ? result.known_for_department
                                                    : result.release_date || result.first_air_date
                                                        ? new Date(
                                                            result.release_date || result.first_air_date
                                                        ).getFullYear()
                                                        : ""}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
