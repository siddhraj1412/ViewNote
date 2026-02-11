"use client";

import Image from "next/image";
import { X, GripVertical } from "lucide-react";
import { tmdb } from "@/lib/tmdb";
import { memo } from "react";

const MediaCard = memo(function MediaCard({
    media,
    onRemove,
    isDraggable = false,
    dragHandleProps = {},
    showRemove = true,
}) {
    const imageUrl = tmdb.getImageUrl(media.poster_path || media.customPoster);
    const title = media.title || media.name;

    return (
        <div className="relative group">
            {/* Drag Handle */}
            {isDraggable && (
                <div
                    {...dragHandleProps}
                    className="absolute top-2 left-2 z-10 bg-black/80 p-1.5 rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Drag to reorder"
                >
                    <GripVertical size={16} className="text-white" />
                </div>
            )}

            {/* Remove Button */}
            {showRemove && onRemove && (
                <button
                    onClick={onRemove}
                    className="absolute top-2 right-2 z-10 bg-black/80 hover:bg-red-600 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Remove"
                >
                    <X size={16} className="text-white" />
                </button>
            )}

            {/* Poster */}
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow">
                <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    loading="lazy"
                />
            </div>

            {/* Title */}
            <h3 className="mt-2 text-sm font-semibold line-clamp-2 group-hover:text-accent transition-colors">
                {title}
            </h3>

            {/* Additional Info */}
            {media.release_date || media.first_air_date ? (
                <p className="text-xs text-textSecondary">
                    {(media.release_date || media.first_air_date).split("-")[0]}
                </p>
            ) : null}
        </div>
    );
});

export default MediaCard;
