"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { tmdb } from "@/lib/tmdb";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import { mediaService } from "@/services/mediaService";

export default function BannerSelectionModal({ isOpen, onClose, onSelect }) {
    const [mediaType, setMediaType] = useState("movie");
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadedImages, setLoadedImages] = useState({});
    const observerRef = useRef(null);
    const searchTimer = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setMediaType("movie");
            setSearchQuery("");
            setResults([]);
            setSelectedMedia(null);
            setBanners([]);
            setLoadedImages({});
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        if (searchTimer.current) clearTimeout(searchTimer.current);

        searchTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const searchFn = mediaType === "movie" ? tmdb.searchMovies : tmdb.searchTV;
                const data = await searchFn(searchQuery);
                setResults(data);
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [searchQuery, mediaType]);

    const selectMedia = async (media) => {
        setSelectedMedia(media);
        setLoading(true);
        setLoadedImages({});

        try {
            // No limit — fetch ALL backdrops
            const images = await mediaService.getBackdrops(media.id, mediaType);
            setBanners(images);
        } catch (error) {
            console.error("Error fetching banners:", error);
            setBanners([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBannerSelect = (banner) => {
        const bannerUrl = tmdb.getImageUrl(banner.file_path, "original");
        onSelect(bannerUrl);
        onClose();
    };

    const handleImageLoad = useCallback((index) => {
        setLoadedImages(prev => ({ ...prev, [index]: true }));
    }, []);

    const handleImageError = useCallback((index, banner) => {
        // Retry once after 1 second
        setTimeout(() => {
            const img = document.querySelector(`[data-banner-idx="${index}"]`);
            if (img) {
                img.src = tmdb.getImageUrl(banner.file_path, "w780");
            }
        }, 1000);
    }, []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Profile Banner" maxWidth="900px">
            <div className="p-6">
                {/* Media Type Selector */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => {
                            setMediaType("movie");
                            setResults([]);
                            setSelectedMedia(null);
                            setBanners([]);
                        }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${mediaType === "movie"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/5"
                            }`}
                    >
                        <Film size={20} />
                        Movies
                    </button>
                    <button
                        onClick={() => {
                            setMediaType("tv");
                            setResults([]);
                            setSelectedMedia(null);
                            setBanners([]);
                        }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${mediaType === "tv"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/5"
                            }`}
                    >
                        <Tv size={20} />
                        TV Shows
                    </button>
                </div>

                {/* Search */}
                {!selectedMedia && (
                    <div className="mb-6">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${mediaType === "movie" ? "movies" : "TV shows"}...`}
                            className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl focus:outline-none focus:border-accent transition"
                        />

                        {/* Search Results — no limit */}
                        {results.length > 0 && (
                            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                                {results.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => selectMedia(item)}
                                        className="w-full flex items-center gap-4 p-3 bg-secondary hover:bg-white/5 rounded-lg transition"
                                    >
                                        <div className="relative w-16 h-24 flex-shrink-0 rounded overflow-hidden bg-background">
                                            {item.poster_path && (
                                                <Image
                                                    src={tmdb.getImageUrl(item.poster_path, "w92")}
                                                    alt={item.title || item.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold">{item.title || item.name}</h3>
                                            <p className="text-sm text-textSecondary">
                                                {(item.release_date || item.first_air_date || "").split("-")[0]}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Banner Selection — all banners, lazy loaded */}
                {selectedMedia && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">
                                {selectedMedia.title || selectedMedia.name}
                                <span className="text-sm font-normal text-textSecondary ml-2">
                                    ({banners.length} banners)
                                </span>
                            </h3>
                            <button
                                onClick={() => {
                                    setSelectedMedia(null);
                                    setBanners([]);
                                    setLoadedImages({});
                                }}
                                className="text-sm text-accent hover:underline"
                            >
                                Change Media
                            </button>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 gap-4">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="aspect-[16/9] rounded-lg bg-secondary animate-pulse" />
                                ))}
                            </div>
                        ) : banners.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-2">
                                {banners.map((banner, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleBannerSelect(banner)}
                                        className="relative aspect-[16/9] rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition group"
                                    >
                                        {/* Skeleton placeholder */}
                                        {!loadedImages[index] && (
                                            <div className="absolute inset-0 bg-secondary animate-pulse" />
                                        )}
                                        <Image
                                            data-banner-idx={index}
                                            src={tmdb.getImageUrl(banner.file_path, "w780")}
                                            alt={`Banner ${index + 1}`}
                                            fill
                                            className="object-cover"
                                            loading="lazy"
                                            onLoad={() => handleImageLoad(index)}
                                            onError={() => handleImageError(index, banner)}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            <span className="text-white font-semibold">Select This Banner</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-textSecondary">No banners available</div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
