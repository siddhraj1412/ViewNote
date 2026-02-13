"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { tmdb } from "@/lib/tmdb";
import { getMovieUrl } from "@/lib/slugify";

/**
 * Legacy route: /movie/[id]
 * Redirects to new SEO-friendly URL: /movies/{slug}-{id}
 * Preserves backward compatibility for old bookmarks and shared links.
 */
export default function MovieLegacyRedirect() {
    const params = useParams();
    const router = useRouter();
    const movieId = Number(params.id);

    useEffect(() => {
        if (!movieId || isNaN(movieId)) return;

        const redirect = async () => {
            try {
                try {
                    // Race the fetch against a 2-second timeout
                    // If fetching data takes too long, just use the fallback URL immediately
                    const fetchPromise = tmdb.getMovieDetails(movieId);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Timeout")), 2000)
                    );

                    const data = await Promise.race([fetchPromise, timeoutPromise]);

                    if (data) {
                        router.replace(getMovieUrl(data));
                        return;
                    }
                } catch (e) {
                    console.warn("Legacy movie redirect fallback (slow network or error):", e);
                }
            } catch (e) {
                console.error("Legacy movie redirect failed:", e);
            }
            // Fallback: go to movies page with just the ID
            router.replace(`/movies/movie-${movieId}`);
        };

        redirect();
    }, [movieId, router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center pt-16">
            <div className="text-2xl text-textSecondary">Redirecting...</div>
        </div>
    );
}
