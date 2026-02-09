"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/search/results?q=${encodeURIComponent(query)}`);
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-5xl font-bold mb-4">Search Movies & Series</h1>
                    <p className="text-textSecondary mb-8">
                        Find your next watch. Discover hidden gems.
                    </p>

                    <form onSubmit={handleSearch} className="flex gap-4">
                        <Input
                            type="text"
                            placeholder="Search for movies, TV shows..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit">
                            <SearchIcon size={20} />
                        </Button>
                    </form>

                    <div className="mt-12 text-left">
                        <h2 className="text-2xl font-bold mb-4">Popular Searches</h2>
                        <div className="flex flex-wrap gap-3">
                            {["Avatar", "Inception", "Breaking Bad", "The Office", "Interstellar"].map(
                                (term) => (
                                    <button
                                        key={term}
                                        onClick={() => {
                                            setQuery(term);
                                            router.push(`/search/results?q=${encodeURIComponent(term)}`);
                                        }}
                                        className="bg-secondary px-4 py-2 rounded-lg hover:bg-accent hover:text-background transition"
                                    >
                                        {term}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
