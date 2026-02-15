"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2, Tv, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

/**
 * 3-step dialog: Search Series → Pick Season → Pick Episode → Fill into slots.
 * Max 5 favorite episodes.
 */
export default function FavoriteEpisodesDialog({ isOpen, onClose, onSave, currentFavorites = [] }) {
    const [step, setStep] = useState("search"); // "search" | "seasons" | "episodes"
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [slots, setSlots] = useState([null, null, null, null, null]);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef(null);
    const debounceTimer = useRef(null);

    // Selected series for season/episode picking
    const [selectedSeries, setSelectedSeries] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [episodes, setEpisodes] = useState([]);

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
            setStep("search");
            setSelectedSeries(null);
            setSeasons([]);
            setSelectedSeason(null);
            setEpisodes([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, currentFavorites]);

    // Debounced search for TV shows
    useEffect(() => {
        if (!query.trim() || step !== "search") {
            setResults([]);
            return;
        }
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await tmdb.searchTV(query);
                setResults(data.slice(0, 12));
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [query, step]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    const handleSelectSeries = useCallback(async (series) => {
        setLoading(true);
        setSelectedSeries(series);
        try {
            const data = await tmdb.getTVDetails(series.id);
            const tvSeasons = (data?.seasons || [])
                .filter((s) => s && typeof s.season_number === "number" && s.season_number > 0)
                .sort((a, b) => a.season_number - b.season_number);
            setSeasons(tvSeasons);
            setStep("seasons");
        } catch {
            setSeasons([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSelectSeason = useCallback(async (season) => {
        setLoading(true);
        setSelectedSeason(season);
        try {
            const data = await tmdb.getTVSeasonDetails(selectedSeries.id, season.season_number);
            setEpisodes(data?.episodes || []);
            setStep("episodes");
        } catch {
            setEpisodes([]);
        } finally {
            setLoading(false);
        }
    }, [selectedSeries]);

    const handleSelectEpisode = useCallback((episode) => {
        const label = `${selectedSeries.name} — S${selectedSeason.season_number}E${episode.episode_number}`;
        const newItem = {
            mediaId: `${selectedSeries.id}_s${selectedSeason.season_number}e${episode.episode_number}`,
            seriesId: selectedSeries.id,
            seasonNumber: selectedSeason.season_number,
            episodeNumber: episode.episode_number,
            title: label,
            episodeName: episode.name || `Episode ${episode.episode_number}`,
            poster_path: episode.still_path || selectedSeries.poster_path || null,
            still_path: episode.still_path || null,
            series_name: selectedSeries.name,
            mediaType: "episode",
            air_date: episode.air_date || null,
        };

        const alreadySelected = slots.some((s) => s && s.mediaId === newItem.mediaId);
        if (alreadySelected) return;

        const emptyIndex = slots.findIndex((s) => s === null);
        if (emptyIndex === -1) return;

        const newSlots = [...slots];
        newSlots[emptyIndex] = newItem;
        setSlots(newSlots);

        // Reset back to search for next pick
        setStep("search");
        setSelectedSeries(null);
        setSeasons([]);
        setSelectedSeason(null);
        setEpisodes([]);
        setQuery("");
        setResults([]);
    }, [selectedSeries, selectedSeason, slots]);

    const handleRemoveSlot = (index) => {
        const newSlots = [...slots];
        newSlots[index] = null;
        setSlots(newSlots);
    };

    const handleBack = () => {
        if (step === "episodes") {
            setStep("seasons");
            setSelectedSeason(null);
            setEpisodes([]);
        } else if (step === "seasons") {
            setStep("search");
            setSelectedSeries(null);
            setSeasons([]);
        }
    };

    const handleSave = () => {
        const items = slots.filter(Boolean);
        onSave(items);
        onClose();
    };

    if (!isOpen || !mounted) return null;

    const filledCount = slots.filter(Boolean).length;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-secondary border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {step !== "search" && (
                            <button onClick={handleBack} className="p-1 rounded-lg hover:bg-white/10 transition text-textSecondary hover:text-white">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-white">
                            {step === "search" && "Favorite Episodes"}
                            {step === "seasons" && `${selectedSeries?.name} — Pick Season`}
                            {step === "episodes" && `Season ${selectedSeason?.season_number} — Pick Episode`}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition text-textSecondary hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Slots preview */}
                <div className="px-5 py-3 border-b border-white/5">
                    <div className="grid grid-cols-5 gap-2">
                        {slots.map((slot, i) => (
                            <div key={i} className="relative aspect-video rounded-lg overflow-hidden bg-background border border-white/5">
                                {slot ? (
                                    <>
                                        {slot.poster_path ? (
                                            <Image
                                                src={`https://image.tmdb.org/t/p/w300${slot.poster_path}`}
                                                alt={slot.title}
                                                fill
                                                className="object-cover"
                                                sizes="120px"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                                <Tv size={16} />
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleRemoveSlot(i)}
                                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white/70 hover:text-white transition z-10"
                                        >
                                            <X size={12} />
                                        </button>
                                        <div className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-[10px] text-white truncate">
                                            {slot.episodeName || slot.title}
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">
                                        {i + 1}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Search / Content area */}
                <div className="flex-1 overflow-y-auto p-5">
                    {step === "search" && (
                        <>
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search for a TV series..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder-textSecondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                                />
                                {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent" />}
                            </div>

                            {results.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {results.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectSeries(item)}
                                            className="text-left rounded-xl overflow-hidden bg-background hover:bg-white/5 transition border border-white/5 hover:border-white/10"
                                        >
                                            <div className="relative aspect-[2/3] bg-white/5">
                                                {item.poster_path ? (
                                                    <Image
                                                        src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                                                        alt={item.name || ""}
                                                        fill
                                                        className="object-cover"
                                                        sizes="180px"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white/20">
                                                        <Tv size={32} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-2">
                                                <p className="text-sm font-medium text-white line-clamp-1">{item.name}</p>
                                                <p className="text-xs text-textSecondary">
                                                    {(item.first_air_date || "").split("-")[0]}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {query.trim() && !loading && results.length === 0 && (
                                <p className="text-sm text-textSecondary text-center py-8">No series found.</p>
                            )}

                            {!query.trim() && filledCount < 5 && (
                                <p className="text-sm text-textSecondary text-center py-8">
                                    Search for a TV series to pick your favorite episodes ({5 - filledCount} slot{5 - filledCount !== 1 ? "s" : ""} remaining).
                                </p>
                            )}
                        </>
                    )}

                    {step === "seasons" && (
                        <>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-accent" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {seasons.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSelectSeason(s)}
                                            className="text-left rounded-xl overflow-hidden bg-background hover:bg-white/5 transition border border-white/5 hover:border-white/10"
                                        >
                                            <div className="relative aspect-[2/3] bg-white/5">
                                                {s.poster_path ? (
                                                    <Image
                                                        src={`https://image.tmdb.org/t/p/w185${s.poster_path}`}
                                                        alt={s.name || `Season ${s.season_number}`}
                                                        fill
                                                        className="object-cover"
                                                        sizes="150px"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white/20">
                                                        <Tv size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-2">
                                                <p className="text-sm font-medium text-white">Season {s.season_number}</p>
                                                <p className="text-xs text-textSecondary">{s.episode_count} episodes</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {step === "episodes" && (
                        <>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-accent" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {episodes.map((ep) => {
                                        const epId = `${selectedSeries.id}_s${selectedSeason.season_number}e${ep.episode_number}`;
                                        const alreadyPicked = slots.some((s) => s && s.mediaId === epId);
                                        return (
                                            <button
                                                key={ep.id}
                                                onClick={() => !alreadyPicked && handleSelectEpisode(ep)}
                                                disabled={alreadyPicked}
                                                className={`w-full text-left flex gap-3 rounded-xl p-3 transition border ${
                                                    alreadyPicked
                                                        ? "bg-accent/10 border-accent/30 opacity-60 cursor-not-allowed"
                                                        : "bg-background hover:bg-white/5 border-white/5 hover:border-white/10"
                                                }`}
                                            >
                                                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                                                    {ep.still_path ? (
                                                        <Image
                                                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                            alt={ep.name || `Episode ${ep.episode_number}`}
                                                            fill
                                                            className="object-cover"
                                                            sizes="112px"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                                                            E{ep.episode_number}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white">
                                                        E{ep.episode_number}: {ep.name || `Episode ${ep.episode_number}`}
                                                    </p>
                                                    {ep.overview && (
                                                        <p className="text-xs text-textSecondary mt-1 line-clamp-2">{ep.overview}</p>
                                                    )}
                                                    {alreadyPicked && (
                                                        <span className="text-xs text-accent mt-1 inline-block">Already selected</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-textSecondary hover:text-white transition text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-lg bg-accent text-background font-semibold hover:opacity-90 transition text-sm"
                    >
                        Save ({filledCount}/5)
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
