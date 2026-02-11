"use client";

import ProductionCard from "./ProductionCard";

/**
 * Production houses section for movie/TV detail pages
 * Displays after "More Crew" button
 */
export default function ProductionSection({ productions = [] }) {
    if (!productions || productions.length === 0) return null;

    return (
        <section className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Production Companies</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productions.map((production) => (
                    <ProductionCard key={production.id} production={production} />
                ))}
            </div>
        </section>
    );
}
