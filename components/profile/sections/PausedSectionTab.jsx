"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import PausedSection from "../PausedSection";

export default function PausedSectionTab() {
    const [filter, setFilter] = useState("all");
    const [counts, setCounts] = useState({
        all: 0,
        movies: 0,
        series: 0,
        short: 0,
    });
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchPausedCounts = async () => {
            if (!user?.uid) {
                setLoading(false);
                return;
            }

            try {
                // TODO: Replace with actual API call
                setCounts({
                    all: 0,
                    movies: 0,
                    series: 0,
                    short: 0,
                });
            } catch (error) {
                console.error("Error fetching paused counts:", error);
                setCounts({
                    all: 0,
                    movies: 0,
                    series: 0,
                    short: 0,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchPausedCounts();
    }, [user]);

    if (loading) {
        return (
            <div className="text-center py-12">
                <p className="text-textSecondary">Loading...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filter Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={() => setFilter("all")}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${filter === "all"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/10"
                        }`}
                >
                    All ({counts.all})
                </button>
                <button
                    onClick={() => setFilter("movies")}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${filter === "movies"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/10"
                        }`}
                >
                    Movies ({counts.movies})
                </button>
                <button
                    onClick={() => setFilter("series")}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${filter === "series"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/10"
                        }`}
                >
                    Series ({counts.series})
                </button>
                <button
                    onClick={() => setFilter("short")}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${filter === "short"
                            ? "bg-accent text-background"
                            : "bg-secondary text-textSecondary hover:bg-white/10"
                        }`}
                >
                    Short Films ({counts.short})
                </button>
            </div>

            {/* Content */}
            <PausedSection pausedMovies={[]} pausedTV={[]} filter={filter} />
        </div>
    );
}
