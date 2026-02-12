"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2, Film, Tv } from "lucide-react";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

export default function FavoritesEditDialog({ isOpen, onClose, onSave, type = "movie", currentFavorites = [] }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [slots, setSlots] = useState([null, null, null, null, null]);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef(null);
    const debounceTimer = useRef(null);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Initialize slots from current favorites
    useEffect(() => {
        if (isOpen) {
            const initial = [null, null, null, null, null];
            currentFavorites.forEach((fav, i) => {
                if (i < 5) initial[i] = fav;
            });
            setSlots(initial);
            setQuery("");
            setResults([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, currentFavorites]);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const searchFn = type === "movie" ? tmdb.searchMovies : tmdb.searchTV;
                const data = await searchFn(query);
                setResults(data.slice(0, 12));
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [query, type]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    // PART 6: Reset search after selection
    const handleSelectResult = (item) => {
        const alreadySelected = slots.some(s => s && s.mediaId === item.id);
        if (alreadySelected) return;

        const emptyIndex = slots.findIndex(s => s === null);
        if (emptyIndex === -1) return;

        const newSlots = [...slots];
        newSlots[emptyIndex] = {
            mediaId: item.id,
            title: item.title || item.name,
            poster_path: item.poster_path,
            release_date: item.release_date || item.first_air_date,
            mediaType: type,
        };
        setSlots(newSlots);

        // Clear search immediately after selection
        setQuery("");
        setResults([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleRemoveSlot = (index) => {
        const newSlots = [...slots];
        newSlots[index] = null;
        const filled = newSlots.filter(s => s !== null);
        const compacted = [...filled, ...Array(5 - filled.length).fill(null)];
        setSlots(compacted);
    };

    // PART 5: Order dropdown — move item to specific position
    const handleOrderChange = (currentIndex, newPosition) => {
        const targetIndex = newPosition - 1; // Convert 1-based to 0-based
        if (currentIndex === targetIndex) return;

        const filled = slots.filter(s => s !== null);
        const item = filled[currentIndex];
        if (!item) return;

        // Remove from current position
        filled.splice(currentIndex, 1);
        // Insert at new position
        filled.splice(targetIndex, 0, item);

        // Rebuild slots
        const newSlots = [...filled, ...Array(5 - filled.length).fill(null)];
        setSlots(newSlots);
    };

    const handleSave = () => {
        const filled = slots.filter(s => s !== null);
        onSave(filled);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") onClose();
    };

    const isAlreadySelected = (itemId) => slots.some(s => s && s.mediaId === itemId);
    const filledCount = slots.filter(s => s !== null).length;
    const typeLabel = type === "movie" ? "Movies" : "Series";

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={onClose}
            onKeyDown={handleKeyDown}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div
                className="relative bg-[#14141e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full"
                style={{ maxWidth: "720px", maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {type === "movie" ? <Film size={22} className="text-accent" /> : <Tv size={22} className="text-accent" />}
                        <h2 className="text-xl font-bold">Edit Favorite {typeLabel}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition" aria-label="Close">
                        <X size={22} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-6">
                    {/* 5-Slot Grid with Order Dropdowns */}
                    <div>
                        <p className="text-sm text-white/50 mb-3">{filledCount}/5 slots filled</p>
                        <div className="grid grid-cols-5 gap-3">
                            {slots.map((slot, index) => (
                                <div key={index} className="relative group">
                                    {slot ? (
                                        <>
                                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary">
                                                {slot.poster_path ? (
                                                    <Image
                                                        src={tmdb.getImageUrl(slot.poster_path, "w185")}
                                                        alt={slot.title || "Poster"}
                                                        fill
                                                        className="object-cover"
                                                        sizes="120px"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                        <Film size={20} className="text-white/20" />
                                                    </div>
                                                )}
                                                {/* Remove button */}
                                                <button
                                                    onClick={() => handleRemoveSlot(index)}
                                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                                                    aria-label="Remove"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <p className="mt-1 text-[10px] text-white/50 line-clamp-1 text-center">{slot.title}</p>
                                            {/* Order dropdown */}
                                            <select
                                                value={index + 1}
                                                onChange={(e) => handleOrderChange(index, parseInt(e.target.value))}
                                                className="mt-1 w-full text-[10px] bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white/70 text-center cursor-pointer hover:bg-white/10 transition focus:outline-none focus:border-accent"
                                                aria-label={`Position for ${slot.title}`}
                                            >
                                                {Array.from({ length: filledCount }, (_, i) => (
                                                    <option key={i + 1} value={i + 1}>
                                                        #{i + 1}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    ) : (
                                        <div className="aspect-[2/3] rounded-xl border border-dashed border-white/15 flex items-center justify-center bg-white/5">
                                            <span className="text-xs text-white/20 font-medium">#{index + 1}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" size={18} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search ${type === "movie" ? "movies" : "TV shows"}...`}
                            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent transition-colors text-white text-sm"
                        />
                        {loading && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-accent animate-spin" size={18} />
                        )}
                    </div>

                    {/* Search Results */}
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                        {results.length === 0 && query && !loading && (
                            <p className="text-center text-textSecondary py-6 text-sm">No results found</p>
                        )}

                        {results.map((item) => {
                            const selected = isAlreadySelected(item.id);
                            const title = item.title || item.name;
                            const year = (item.release_date || item.first_air_date || "").split("-")[0];

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectResult(item)}
                                    disabled={selected || filledCount >= 5}
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${selected
                                        ? "bg-accent/10 border border-accent/30 opacity-60 cursor-not-allowed"
                                        : filledCount >= 5
                                            ? "bg-white/5 opacity-40 cursor-not-allowed"
                                            : "bg-white/5 hover:bg-white/10 border border-transparent"
                                        }`}
                                >
                                    <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-white/5">
                                        {item.poster_path ? (
                                            <Image
                                                src={tmdb.getImageUrl(item.poster_path, "w92")}
                                                alt={title}
                                                fill
                                                className="object-cover"
                                                sizes="40px"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Film size={14} className="text-white/20" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white line-clamp-1">{title}</p>
                                        <p className="text-xs text-white/50">{year}</p>
                                    </div>

                                    {selected && (
                                        <span className="text-xs text-accent font-medium flex-shrink-0">Added</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0 bg-[#14141e]">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 text-sm font-medium bg-accent text-background rounded-lg hover:bg-accent/90 transition shadow-lg shadow-accent/20"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
