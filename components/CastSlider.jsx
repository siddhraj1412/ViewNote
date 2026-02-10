"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tmdb } from "@/lib/tmdb";

export default function CastSlider({ cast = [] }) {
    const scrollRef = useRef(null);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    if (!cast || cast.length === 0) {
        return null;
    }

    return (
        <div className="relative group">
            {/* Left Arrow */}
            <button
                onClick={() => scroll("left")}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Scroll left"
            >
                <ChevronLeft size={24} />
            </button>

            {/* Cast Container */}
            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {cast.map((person) => (
                    <Link
                        key={person.id}
                        href={`/person/${person.id}`}
                        className="flex-shrink-0 w-32 group/card"
                    >
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-secondary">
                            <Image
                                src={tmdb.getImageUrl(person.profile_path, "w185", "profile")}
                                alt={person.name}
                                fill
                                className="object-cover group-hover/card:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                        </div>
                        <h3 className="font-medium text-sm line-clamp-2 mb-1">
                            {person.name}
                        </h3>
                        {person.character && (
                            <p className="text-xs text-textSecondary line-clamp-2">
                                {person.character}
                            </p>
                        )}
                    </Link>
                ))}
            </div>

            {/* Right Arrow */}
            <button
                onClick={() => scroll("right")}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Scroll right"
            >
                <ChevronRight size={24} />
            </button>
        </div>
    );
}
