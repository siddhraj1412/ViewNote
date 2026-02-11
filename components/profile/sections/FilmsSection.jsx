"use client";

import WatchedSection from "../WatchedSection";

export default function FilmsSection() {
    return (
        <div className="space-y-8">
            <WatchedSection watchedMovies={[]} watchedTV={[]} />
        </div>
    );
}
