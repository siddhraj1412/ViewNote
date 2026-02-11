"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { Search, Loader2 } from "lucide-react";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

export default function SearchModal({ isOpen, onClose, onSelect, type = "movie", title = "Search" }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const debounceTimer = useRef(null);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery("");
            setResults([]);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        // Debounce search
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const searchFn = type === "movie" ? tmdb.searchMovies : tmdb.searchTV;
                const data = await searchFn(query);
                setResults(data.slice(0, 10)); // Limit to 10 results
                setSelectedIndex(0);
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [query, type]);

    const handleKeyDown = (e) => {
        if (!results.length) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % results.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
                break;
            case "Enter":
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case "Escape":
                e.preventDefault();
                onClose();
                break;
        }
    };

    const handleSelect = (item) => {
        onSelect(item);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="600px">
            <div className="p-6">
                {/* Search Input */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Search ${type === "movie" ? "movies" : "TV shows"}...`}
                        className="w-full pl-12 pr-4 py-3 bg-background border border-white/10 rounded-xl focus:outline-none focus:border-accent transition-colors text-white"
                        aria-label="Search input"
                        aria-autocomplete="list"
                        aria-controls="search-results"
                        aria-activedescendant={results[selectedIndex] ? `result-${selectedIndex}` : undefined}
                    />
                    {loading && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-accent animate-spin" size={20} />
                    )}
                </div>

                {/* Results */}
                <div
                    id="search-results"
                    className="space-y-2 max-h-[400px] overflow-y-auto"
                    role="listbox"
                    aria-label="Search results"
                >
                    {results.length === 0 && query && !loading && (
                        <p className="text-center text-textSecondary py-8">No results found</p>
                    )}

                    {results.map((item, index) => (
                        <button
                            key={item.id}
                            id={`result-${index}`}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${index === selectedIndex
                                    ? "bg-accent/20 border border-accent"
                                    : "bg-white/5 hover:bg-white/10 border border-transparent"
                                }`}
                            role="option"
                            aria-selected={index === selectedIndex}
                        >
                            {/* Poster */}
                            <div className="relative w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-secondary">
                                {item.poster_path ? (
                                    <Image
                                        src={tmdb.getImageUrl(item.poster_path, "w92")}
                                        alt={item.title || item.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-textSecondary text-xs">
                                        No Image
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-left">
                                <h3 className="font-semibold text-white line-clamp-1">
                                    {item.title || item.name}
                                </h3>
                                <p className="text-sm text-textSecondary">
                                    {(item.release_date || item.first_air_date || "").split("-")[0]}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
