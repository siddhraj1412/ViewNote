"use client";

import { useState } from "react";
import MediaGrid from "@/components/MediaGrid";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

export default function WatchedSection({ watchedMovies = [], watchedTV = [] }) {
    const [activeTab, setActiveTab] = useState("movies");

    const displayData = activeTab === "movies" ? watchedMovies : watchedTV;

    return (
        <section>
            <h2 className="text-3xl font-bold mb-6">Watched</h2>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab("movies")}
                    className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === "movies"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/5"
                        }`}
                >
                    Movies ({watchedMovies.length})
                </button>
                <button
                    onClick={() => setActiveTab("tv")}
                    className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === "tv"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/5"
                        }`}
                >
                    TV Shows ({watchedTV.length})
                </button>
            </div>

            {/* Grid */}
            {displayData.length > 0 ? (
                <MediaGrid>
                    {displayData.map((item) => (
                        <Link
                            key={item.id}
                            href={`/${activeTab === "movies" ? "movie" : "tv"}/${item.mediaId}`}
                            className="group"
                        >
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow">
                                <Image
                                    src={tmdb.getImageUrl(item.poster_path)}
                                    alt={item.title || item.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="mt-2 text-sm font-semibold line-clamp-2 group-hover:text-accent transition-colors">
                                {item.title || item.name}
                            </h3>
                            <p className="text-xs text-textSecondary">
                                Watched {new Date(item.watchedAt).toLocaleDateString()}
                            </p>
                        </Link>
                    ))}
                </MediaGrid>
            ) : (
                <div className="text-center py-12 text-textSecondary">
                    No {activeTab} watched yet
                </div>
            )}
        </section>
    );
}
