"use client";

import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { useMediaCustomization } from "@/hooks/useMediaCustomization";
import { Eye, EyeOff, Star } from "lucide-react";

export default function SeasonCard({
    rawShowSlug,
    seriesId,
    season,
    isWatched = false,
    onToggleWatched,
    onQuickRate,
}) {
    const seasonNumber = Number(season?.season_number);
    const customizationMediaId = `${Number(seriesId)}_season_${seasonNumber}`;

    const { customPoster } = useMediaCustomization(
        customizationMediaId,
        "tv",
        season?.poster_path,
        null
    );

    const href = `/show/${encodeURIComponent(rawShowSlug)}/season/${season.id}/${seasonNumber}`;
    const img = tmdb.getImageUrl(customPoster || season.poster_path, "w500", "poster");

    const handleEyeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleWatched) onToggleWatched(seasonNumber);
    };

    const handleStarClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onQuickRate) onQuickRate(seasonNumber);
    };

    return (
        <Link href={href} className="group">
            <div className="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all">
                <div className="relative aspect-[2/3] bg-white/5">
                    <Image
                        src={img}
                        alt={season.name || `Season ${seasonNumber}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        loading="lazy"
                    />
                    {/* Overlay icons */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                        {onToggleWatched && (
                            <button
                                onClick={handleEyeClick}
                                className={`p-1.5 rounded-lg backdrop-blur-sm transition-all ${
                                    isWatched
                                        ? "bg-accent/90 text-white"
                                        : "bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white"
                                }`}
                                title={isWatched ? "Mark as unwatched" : "Mark as watched"}
                            >
                                {isWatched ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        )}
                        {onQuickRate && (
                            <button
                                onClick={handleStarClick}
                                className="p-1.5 rounded-lg bg-black/60 text-white/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:text-accent transition-all"
                                title="Rate this season"
                            >
                                <Star size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-4">
                    <div className="font-bold text-white line-clamp-1">
                        {season.name || `Season ${seasonNumber}`}
                    </div>
                    <div className="text-xs text-textSecondary mt-1">
                        Season {seasonNumber}
                        {season.episode_count ? ` • ${season.episode_count} episode${season.episode_count !== 1 ? "s" : ""}` : ""}
                    </div>
                    {season.overview ? (
                        <div className="text-sm text-textSecondary mt-2 line-clamp-2">{season.overview}</div>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}
