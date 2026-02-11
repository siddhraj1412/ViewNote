"use client";

import MediaGrid from "@/components/MediaGrid";
import { Tv } from "lucide-react";

export default function WatchingSection() {
    return (
        <section>
            <h2 className="text-3xl font-bold mb-6">Currently Watching</h2>

            <div className="text-center py-12">
                <Tv size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                <p className="text-textSecondary mb-2">No TV shows currently watching</p>
                <p className="text-sm text-textSecondary opacity-70">
                    Start watching a TV show to see it here
                </p>
            </div>
        </section>
    );
}
