"use client";

import { useEffect } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import FavoriteMovies from "./FavoriteMovies";
import FavoriteShows from "./FavoriteShows";
import FavoriteEpisodes from "./FavoriteEpisodes";

export default function FavoritesMatrix() {
    const { favorites, loading, loadFavorites, addFavorite, removeFavorite, reorderFavorites } = useFavorites();

    useEffect(() => {
        loadFavorites();
    }, [loadFavorites]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-textSecondary">Loading favorites...</div>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            <FavoriteMovies
                favorites={favorites.movies}
                onAdd={(movie) => addFavorite("movies", movie)}
                onRemove={(id) => removeFavorite("movies", id)}
                onReorder={(newOrder) => reorderFavorites("movies", newOrder)}
            />

            <FavoriteShows
                favorites={favorites.shows}
                onAdd={(show) => addFavorite("shows", show)}
                onRemove={(id) => removeFavorite("shows", id)}
                onReorder={(newOrder) => reorderFavorites("shows", newOrder)}
            />

            <FavoriteEpisodes
                favorites={favorites.episodes}
                onAdd={(episode) => addFavorite("episodes", episode)}
                onRemove={(id) => removeFavorite("episodes", id)}
                onReorder={(newOrder) => reorderFavorites("episodes", newOrder)}
            />
        </div>
    );
}
