"use client";

import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";

/**
 * Production house card component
 * Displays production company logo and name in rectangle container
 */
export default function ProductionCard({ production }) {
    if (!production) return null;

    return (
        <Link
            href={`/production/${production.id}`}
            className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg border border-white/10 hover:border-accent/50 transition-all group"
        >
            {/* Logo */}
            {production.logo_path && (
                <div className="relative w-20 h-20 flex-shrink-0 bg-white/5 rounded-lg overflow-hidden p-2">
                    <Image
                        src={tmdb.getImageUrl(production.logo_path, "w200")}
                        alt={production.name}
                        fill
                        className="object-contain"
                    />
                </div>
            )}

            {/* Name - Full, no truncation */}
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold group-hover:text-accent transition-colors whitespace-normal break-words">
                    {production.name}
                </h3>
                {production.origin_country && (
                    <p className="text-sm text-textSecondary mt-1">
                        {production.origin_country}
                    </p>
                )}
            </div>
        </Link>
    );
}
