"use client";

import MediaGrid from "@/components/MediaGrid";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getMediaUrl } from "@/lib/slugify";
import { Play } from "lucide-react";

export default function PausedSection({ pausedMovies = [], pausedTV = [] }) {
    const allPaused = [...pausedMovies, ...pausedTV];

    return (
        <section>
            <h2 className="text-3xl font-bold mb-6">Paused</h2>

            {allPaused.length > 0 ? (
                <MediaGrid>
                    {allPaused.map((item) => (
                        <div key={item.id} className="group">
                            <Link
                                href={getMediaUrl(item, item.mediaType)}
                                className="block"
                            >
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow">
                                    <Image
                                        src={tmdb.getImageUrl(item.poster_path)}
                                        alt={item.title || item.name}
                                        fill
                                        className="object-cover"
                                    />
                                    {/* Resume overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play size={48} className="text-white" />
                                    </div>
                                </div>
                                <h3 className="mt-2 text-sm font-semibold line-clamp-2 group-hover:text-accent transition-colors">
                                    {item.title || item.name}
                                </h3>
                                <p className="text-xs text-textSecondary">
                                    Paused {new Date(item.pausedAt).toLocaleDateString()}
                                </p>
                            </Link>
                        </div>
                    ))}
                </MediaGrid>
            ) : (
                <div className="text-center py-12 text-textSecondary">
                    No paused content
                </div>
            )}
        </section>
    );
}
