"use client";

import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { getPersonUrl } from "@/lib/slugify";

export default function CastGrid({ cast = [] }) {
    const list = Array.isArray(cast) ? cast : [];
    if (list.length === 0) return null;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {list.map((person) => (
                <Link
                    key={person.id}
                    href={getPersonUrl(person)}
                    className="group"
                    title={person.character ? `${person.name} as ${person.character}` : person.name}
                >
                    <div className="mx-auto relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-secondary border border-white/10">
                        <Image
                            src={tmdb.getImageUrl(person.profile_path, "w185", "profile")}
                            alt={person.name}
                            fill
                            className="object-cover"
                            loading="lazy"
                        />
                    </div>
                    <div className="mt-3 text-center">
                        <div className="font-bold text-sm text-white line-clamp-2 group-hover:text-accent transition-colors">
                            {person.name}
                        </div>
                        {person.character ? (
                            <div className="text-xs text-textSecondary line-clamp-2 mt-1">{person.character}</div>
                        ) : null}
                    </div>
                </Link>
            ))}
        </div>
    );
}
