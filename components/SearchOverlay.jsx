"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Film, Tv, User, Users } from "lucide-react";
import { tmdb } from "@/lib/tmdb";
import { getMovieUrl, getShowUrl, getPersonUrl } from "@/lib/slugify";
import supabase from "@/lib/supabase";

export default function SearchOverlay({ isOpen, onClose }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState([]);
    const [userResults, setUserResults] = useState([]);
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
            setSearchQuery("");
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setResults([]);
            setUserResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const [tmdbData, users] = await Promise.all([
                    tmdb.searchMulti(searchQuery),
                    searchUsers(searchQuery.trim().toLowerCase()),
                ]);
                setResults(tmdbData.results.slice(0, 10));
                setUserResults(users);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    const handleUserClick = (userProfile) => {
        router.push(`/${userProfile.username}`);
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

    const displayResults = searchQuery.trim() ? results : popularResults;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 z-[10050] backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Search Panel */}
            <div className="fixed top-0 left-0 right-0 z-[10050]">
                <div className="site-container py-4">
                    <div className="bg-secondary border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        {/* Search Input */}
                        <div className="flex items-center gap-3 p-4 border-b border-white/10">
                            <Search size={20} className="text-textSecondary" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search movies, TV shows, people, or users..."
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

                        {!loading && displayResults.length === 0 && userResults.length === 0 && searchQuery.trim() && (
                            <div className="p-8 text-center text-textSecondary">
                                No results found
                            </div>
                        )}

                        {!loading && displayResults.length === 0 && !searchQuery.trim() && (
                            <div className="p-4">
                                <p className="text-sm text-textSecondary mb-3 px-2">
                                    Popular Now
                                </p>
                            </div>
                        )}

                        {!loading && (displayResults.length > 0 || userResults.length > 0) && (
                            <div className="p-2">
                                {!searchQuery.trim() && (
                                    <p className="text-sm text-textSecondary mb-2 px-2">
                                        Popular Now
                                    </p>
                                )}

                                {/* User results */}
                                {userResults.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1 px-2 mt-1">Users</p>
                                        {userResults.map((u) => (
                                            <button
                                                key={u.id}
                                                onClick={() => handleUserClick(u)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition text-left"
                                            >
                                                <div className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-background">
                                                    {(u.profile_picture_url || u.photoURL) ? (
                                                        <img
                                                            src={u.profile_picture_url || u.photoURL}
                                                            alt={u.username}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-accent/20 text-accent text-sm font-bold">
                                                            {(u.username || "U")[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <Users size={14} className="text-accent shrink-0" />
                                                        <h3 className="font-medium truncate">@{u.username}</h3>
                                                    </div>
                                                    {u.displayName && (
                                                        <p className="text-sm text-textSecondary truncate">{u.displayName}</p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}

                                {/* Media results */}
                                {displayResults.length > 0 && userResults.length > 0 && searchQuery.trim() && (
                                    <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1 px-2 mt-3">Media & People</p>
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
            </div>
        </>
    );
}

async function searchUsers(term) {
    if (!term || term.length < 2) return [];
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .ilike("username", term + "%")
            .limit(5);
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("User search error:", err);
        return [];
    }
}
