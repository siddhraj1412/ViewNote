"use client";

import { useState, useEffect } from "react";
import supabase from "@/lib/supabase";
import { tmdb } from "@/lib/tmdb";
import { getMovieUrl, getShowUrl } from "@/lib/slugify";
import Image from "next/image";
import Link from "next/link";

export default function ProfileFavorites({ userId }) {
    const [profile, setProfile] = useState(null);
    const [favoriteMovie, setFavoriteMovie] = useState(null);
    const [favoriteSeries, setFavoriteSeries] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            loadProfile();
        }
    }, [userId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (data) {
                setProfile(data);

                // Load favorite movie details
                if (data.favorite_movie_id) {
                    const movie = await tmdb.getMovieDetails(data.favorite_movie_id);
                    setFavoriteMovie(movie);
                }

                // Load favorite series details
                if (data.favorite_series_id) {
                    const series = await tmdb.getTVDetails(data.favorite_series_id);
                    setFavoriteSeries(series);
                }
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-[2/3] bg-secondary rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Favorites</h2>
            <div className="grid grid-cols-3 gap-4">
                {/* Favorite Movie */}
                <div>
                    <h3 className="text-sm font-semibold text-textSecondary mb-2">Favorite Movie</h3>
                    {favoriteMovie ? (
                        <Link
                            href={getMovieUrl(favoriteMovie)}
                            className="relative aspect-[2/3] w-full rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:shadow-accent/10 transition block group"
                        >
                            <Image
                                src={tmdb.getImageUrl(favoriteMovie.poster_path)}
                                alt={favoriteMovie.title}
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <span className="text-white font-semibold">View Movie</span>
                            </div>
                        </Link>
                    ) : (
                        <div className="aspect-[2/3] bg-secondary rounded-xl flex items-center justify-center text-textSecondary">
                            No movie selected
                        </div>
                    )}
                </div>

                {/* Favorite Series */}
                <div>
                    <h3 className="text-sm font-semibold text-textSecondary mb-2">Favorite Series</h3>
                    {favoriteSeries ? (
                        <Link
                            href={getShowUrl(favoriteSeries)}
                            className="relative aspect-[2/3] w-full rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:shadow-accent/10 transition block group"
                        >
                            <Image
                                src={tmdb.getImageUrl(favoriteSeries.poster_path)}
                                alt={favoriteSeries.name}
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <span className="text-white font-semibold">View Series</span>
                            </div>
                        </Link>
                    ) : (
                        <div className="aspect-[2/3] bg-secondary rounded-xl flex items-center justify-center text-textSecondary">
                            No series selected
                        </div>
                    )}
                </div>

                {/* Favorite Episode */}
                <div>
                    <h3 className="text-sm font-semibold text-textSecondary mb-2">Favorite Episode</h3>
                    <div className="aspect-[2/3] bg-secondary rounded-xl flex items-center justify-center text-textSecondary">
                        Coming Soon
                    </div>
                </div>
            </div>
        </div>
    );
}
