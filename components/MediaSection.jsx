"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

export default function MediaSection({ title = "Media", posters = [], backdrops = [] }) {
    const [showAllPosters, setShowAllPosters] = useState(false);
    const [showAllBanners, setShowAllBanners] = useState(false);

    const displayPosters = useMemo(() => {
        const list = Array.isArray(posters) ? posters : [];
        return showAllPosters ? list : list.slice(0, 10);
    }, [posters, showAllPosters]);

    const displayBackdrops = useMemo(() => {
        const list = Array.isArray(backdrops) ? backdrops : [];
        return showAllBanners ? list : list.slice(0, 10);
    }, [backdrops, showAllBanners]);

    const hasMorePosters = (posters?.length || 0) > 10;
    const hasMoreBanners = (backdrops?.length || 0) > 10;

    if ((posters?.length || 0) === 0 && (backdrops?.length || 0) === 0) return null;

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">{title}</h2>
            </div>

            {(backdrops?.length || 0) > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-white">Banners</div>
                        {hasMoreBanners && (
                            <button
                                onClick={() => setShowAllBanners((v) => !v)}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                            >
                                {showAllBanners ? "See Less" : "See More"}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayBackdrops.map((b, idx) => {
                            const path = b.file_path || b;
                            return (
                                <div key={`${path}-${idx}`} className="relative aspect-video rounded-xl overflow-hidden bg-secondary border border-white/5">
                                    <Image
                                        src={tmdb.getImageUrl(path, "w780", "backdrop")}
                                        alt="Banner"
                                        fill
                                        className="object-contain"
                                        loading="lazy"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {(posters?.length || 0) > 0 && (
                <div className="space-y-4 mt-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-white">Posters</div>
                        {hasMorePosters && (
                            <button
                                onClick={() => setShowAllPosters((v) => !v)}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                            >
                                {showAllPosters ? "See Less" : "See More"}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {displayPosters.map((p, idx) => {
                            const path = p.file_path || p;
                            return (
                                <div key={`${path}-${idx}`} className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary border border-white/5">
                                    <Image
                                        src={tmdb.getImageUrl(path, "w500", "poster")}
                                        alt="Poster"
                                        fill
                                        className="object-contain"
                                        loading="lazy"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
