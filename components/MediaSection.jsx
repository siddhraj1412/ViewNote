"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

export default function MediaSection({ title = "Media", posters = [], backdrops = [], videos = [] }) {
    const [showAllPosters, setShowAllPosters] = useState(false);
    const [showAllBanners, setShowAllBanners] = useState(false);
    const [showAllVideos, setShowAllVideos] = useState(false);

    const displayVideos = useMemo(() => {
        const list = Array.isArray(videos) ? videos : [];
        const filtered = list.filter((v) => v && v.site === "YouTube" && v.key);
        return showAllVideos ? filtered : filtered.slice(0, 4);
    }, [videos, showAllVideos]);

    const displayPosters = useMemo(() => {
        const list = Array.isArray(posters) ? posters : [];
        return showAllPosters ? list : list.slice(0, 8);
    }, [posters, showAllPosters]);

    const displayBackdrops = useMemo(() => {
        const list = Array.isArray(backdrops) ? backdrops : [];
        return showAllBanners ? list : list.slice(0, 4);
    }, [backdrops, showAllBanners]);

    const hasMorePosters = (posters?.length || 0) > 8;
    const hasMoreBanners = (backdrops?.length || 0) > 4;
    const hasMoreVideos = (Array.isArray(videos) ? videos.filter((v) => v && v.site === "YouTube" && v.key).length : 0) > 4;

    if ((posters?.length || 0) === 0 && (backdrops?.length || 0) === 0 && displayVideos.length === 0) return null;

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">{title}</h2>
            </div>

            {displayVideos.length > 0 && (
                <div className="space-y-4 mb-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-white">Videos</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {displayVideos.map((v) => (
                            <div key={v.id || v.key} className="relative aspect-video rounded-xl overflow-hidden bg-secondary border border-white/5">
                                <iframe
                                    src={`https://www.youtube.com/embed/${v.key}`}
                                    title={v.name || "Video"}
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        ))}
                    </div>
                    {hasMoreVideos && (
                        <div className="flex justify-start mt-4">
                            <button
                                onClick={() => setShowAllVideos((v) => !v)}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                            >
                                {showAllVideos ? "See Less" : "See More"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(backdrops?.length || 0) > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-white">Banners</div>
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
                    {hasMoreBanners && (
                        <div className="flex justify-start mt-4">
                            <button
                                onClick={() => setShowAllBanners((v) => !v)}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                            >
                                {showAllBanners ? "See Less" : "See More"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(posters?.length || 0) > 0 && (
                <div className="space-y-4 mt-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-white">Posters</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
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
                    {hasMorePosters && (
                        <div className="flex justify-start mt-4">
                            <button
                                onClick={() => setShowAllPosters((v) => !v)}
                                className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                            >
                                {showAllPosters ? "See Less" : "See More"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
