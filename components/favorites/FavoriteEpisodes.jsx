"use client";

import { useState } from "react";
import MediaGrid from "@/components/MediaGrid";
import EmptySlot from "@/components/EmptySlot";

// Placeholder for episode favorites - will be fully implemented with smart parsing
export default function FavoriteEpisodes({ favorites, onAdd, onRemove, onReorder }) {
    const emptySlots = Math.max(0, 5 - favorites.length);

    return (
        <section>
            <h2 className="text-2xl font-bold mb-4">Favorite Episodes</h2>

            <MediaGrid>
                {favorites.map((favorite) => (
                    <div key={favorite.id} className="relative aspect-[2/3] rounded-xl bg-secondary p-4 flex flex-col justify-center">
                        <h3 className="font-semibold text-sm line-clamp-2">{favorite.showName}</h3>
                        <p className="text-xs text-textSecondary mt-1">
                            S{favorite.season}E{favorite.episode}
                        </p>
                        <p className="text-xs text-textSecondary line-clamp-2 mt-2">
                            {favorite.episodeName}
                        </p>
                    </div>
                ))}

                {Array.from({ length: emptySlots }).map((_, index) => (
                    <EmptySlot
                        key={`empty-${index}`}
                        onClick={() => { }}
                        label="Add Episode"
                    />
                ))}
            </MediaGrid>

            <p className="text-sm text-textSecondary mt-4">
                Episode search coming soon. Format: "Show Name S2E5" or "Show Season 1 Episode 3"
            </p>
        </section>
    );
}
