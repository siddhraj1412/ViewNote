"use client";

import { useState } from "react";
import MediaGrid from "@/components/MediaGrid";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

export default function WatchedSection({ watchedMovies = [], watchedTV = [], filter = "all" }) {
    // Determine what to display based on filter
    const getDisplayData = () => {
        switch (filter) {
            case "movies":
                return { data: watchedMovies, type: "movie", label: "movies" };
            case "series":
                return { data: watchedTV, type: "tv", label: "series" };
            case "short":
                return { data: [], type: "movie", label: "short films" };
            case "all":
            default:
                return { data: [...watchedMovies, ...watchedTV], type: "all", label: "items" };
        }
    };

    const { data: displayData, type: mediaType, label } = getDisplayData();

    return (
        <section>
            {/* Grid — no duplicate heading or tabs */}
            {displayData.length > 0 ? (
                <MediaGrid>
                    {displayData.map((item) => (
                        <Link
                            key={item.id}
                            href={`/${mediaType === "all" ? (item.mediaType || "movie") : mediaType}/${item.mediaId}`}
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
                    No {label} watched yet
                </div>
            )}
        </section>
    );
}
