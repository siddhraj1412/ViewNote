"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { tmdb } from "@/lib/tmdb";

export default function CrewSection({ crew = [] }) {
    const [showAllCrew, setShowAllCrew] = useState(false);

    // Group and prioritize crew
    const { directors, otherCrew } = useMemo(() => {
        if (!crew || crew.length === 0) {
            return { directors: [], otherCrew: {} };
        }

        // Extract directors
        const directors = crew.filter((person) => person.job === "Director");

        // Group ALL other crew by department (excluding directors)
        const otherCrew = crew
            .filter((person) => person.job !== "Director")
            .reduce((acc, person) => {
                const dept = person.department || "Other";
                if (!acc[dept]) {
                    acc[dept] = [];
                }
                acc[dept].push(person);
                return acc;
            }, {});

        return { directors, otherCrew };
    }, [crew]);

    if (!crew || crew.length === 0) {
        return null;
    }

    // Define department order
    const departmentOrder = ["Writing", "Production", "Camera", "Sound", "Editing"];
    const sortedDepartments = Object.keys(otherCrew).sort((a, b) => {
        const aIndex = departmentOrder.indexOf(a);
        const bIndex = departmentOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6">
            {/* Directors Section - Always Visible, FIRST */}
            {directors.length > 0 && (
                <div>
                    <h3 className="text-2xl font-bold mb-4 text-accent">
                        {directors.length > 1 ? "Directors" : "Director"}
                    </h3>
                    <div className="flex flex-wrap gap-6">
                        {directors.map((director, index) => (
                            <Link
                                key={`${director.id}-${index}`}
                                href={`/person/${director.id}`}
                                className="flex flex-col items-center gap-3 group w-32"
                            >
                                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-secondary ring-2 ring-white/10">
                                    <Image
                                        src={tmdb.getImageUrl(
                                            director.profile_path,
                                            "w185",
                                            "profile"
                                        )}
                                        alt={director.name}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold group-hover:text-accent transition text-sm">
                                        {director.name}
                                    </p>
                                    <p className="text-xs text-textSecondary">Director</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* "More" Button - IMMEDIATELY AFTER Director Section */}
            {sortedDepartments.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowAllCrew(!showAllCrew)}
                        className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-white/10 rounded-lg transition font-medium"
                    >
                        {showAllCrew ? (
                            <>
                                <ChevronUp size={20} />
                                <span>Show Less Crew</span>
                            </>
                        ) : (
                            <>
                                <ChevronDown size={20} />
                                <span>Show More Crew</span>
                            </>
                        )}
                    </button>

                    {/* Other Crew - Hidden by default, shown after clicking More */}
                    {showAllCrew && (
                        <div className="mt-6 space-y-6">
                            {sortedDepartments.map((dept) => (
                                <div key={dept}>
                                    <h4 className="text-lg font-semibold mb-3 text-textSecondary">
                                        {dept}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {otherCrew[dept].map((person, index) => (
                                            <Link
                                                key={`${person.id}-${index}`}
                                                href={`/person/${person.id}`}
                                                className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-white/5 transition"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">
                                                        {person.name}
                                                    </p>
                                                    <p className="text-xs text-textSecondary truncate">
                                                        {person.job}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
