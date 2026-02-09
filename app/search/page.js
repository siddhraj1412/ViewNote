"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const router = useRouter();

    const handleSearch = (e) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/search/results?q=${encodeURIComponent(query)}`);
        }
    };

    const popularSearches = ["The Boys", "Inception", "Interstellar", "Batman", "One Piece"];

    return (
        <main className="min-h-[80vh] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl text-center">
                <h1 className="text-5xl font-black mb-8 tracking-tighter">FIND YOUR NEXT WATCH</h1>

                <form onSubmit={handleSearch} className="flex gap-2 mb-12">
                    <Input
                        placeholder="Search movies, series or cast..."
                        className="text-lg py-6"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Button type="submit" size="lg" className="px-8">
                        <Search className="mr-2" /> Search
                    </Button>
                </form>

                <div>
                    <div className="flex items-center justify-center gap-2 mb-4 text-textSecondary uppercase tracking-widest text-xs font-bold">
                        <TrendingUp size={14} /> Popular Searches
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                        {popularSearches.map((term) => (
                            <button
                                key={term}
                                onClick={() => router.push(`/search/results?q=${encodeURIComponent(term)}`)}
                                className="bg-secondary px-4 py-2 rounded-full hover:bg-accent hover:text-background transition-all font-medium"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
