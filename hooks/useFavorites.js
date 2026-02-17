"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

export function useFavorites() {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState({
        movies: [],
        shows: [],
        episodes: [],
    });
    const [loading, setLoading] = useState(false);

    const loadFavorites = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("favorites")
                .select("*")
                .eq("userId", user.uid)
                .order("order", { ascending: true });

            if (error) throw error;

            const grouped = { movies: [], shows: [], episodes: [] };
            (data || []).forEach((row) => {
                if (grouped[row.category]) grouped[row.category].push(row);
            });
            setFavorites(grouped);
        } catch (error) {
            console.error("Error loading favorites:", error);
            showToast.error("Failed to load favorites");
        } finally {
            setLoading(false);
        }
    }, [user]);

    const addFavorite = useCallback(async (type, media) => {
        if (!user) return;
        const currentList = favorites[type];

        if (currentList.length >= 5) {
            showToast.error(`Maximum 5 ${type} allowed`);
            return;
        }
        if (currentList.some(item => item.mediaId === media.id)) {
            showToast.error("Already in favorites");
            return;
        }

        const id = `${user.uid}_${type}_${media.id}`;
        const favoriteData = {
            id,
            userId: user.uid,
            mediaId: media.id,
            mediaType: type === "movies" ? "movie" : type === "shows" ? "tv" : "episode",
            category: type,
            title: media.title || media.name,
            poster_path: media.poster_path,
            release_date: media.release_date || media.first_air_date,
            order: currentList.length,
            createdAt: new Date().toISOString(),
        };

        // Optimistic update
        const previousFavorites = { ...favorites };
        setFavorites(prev => ({
            ...prev,
            [type]: [...prev[type], favoriteData],
        }));

        try {
            const { error } = await supabase.from("favorites").upsert(favoriteData);
            if (error) throw error;

            eventBus.emit("FAVORITES_UPDATED", { type });
            showToast.success(`Added to Favorite ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        } catch (error) {
            setFavorites(previousFavorites); // Rollback
            console.error("Error adding favorite:", error);
            showToast.error("Failed to add favorite");
        }
    }, [user, favorites]);

    const removeFavorite = useCallback(async (type, id) => {
        if (!user) return;

        // Optimistic update
        const previousFavorites = { ...favorites };
        setFavorites(prev => ({
            ...prev,
            [type]: prev[type].filter(item => item.id !== id),
        }));

        try {
            const { error } = await supabase.from("favorites").delete().eq("id", id);
            if (error) throw error;

            eventBus.emit("FAVORITES_UPDATED", { type });
            showToast.success(`Removed from Favorite ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        } catch (error) {
            setFavorites(previousFavorites); // Rollback
            console.error("Error removing favorite:", error);
            showToast.error("Failed to remove favorite");
        }
    }, [user, favorites]);

    const reorderFavorites = useCallback(async (type, newOrder) => {
        if (!user) return;

        // Optimistic update
        const previousFavorites = { ...favorites };
        setFavorites(prev => ({
            ...prev,
            [type]: newOrder.map((item, index) => ({ ...item, order: index })),
        }));

        try {
            // Batch update with upsert instead of N individual updates
            const updates = newOrder.map((item, index) => ({
                id: item.id,
                userId: user.uid,
                mediaId: item.mediaId,
                mediaType: item.mediaType,
                category: item.category,
                title: item.title,
                poster_path: item.poster_path,
                release_date: item.release_date,
                order: index,
                createdAt: item.createdAt,
            }));
            const { error } = await supabase.from("favorites").upsert(updates);
            if (error) throw error;

            eventBus.emit("FAVORITES_UPDATED", { type });
            showToast.success("Reordered Favorites");
        } catch (error) {
            setFavorites(previousFavorites); // Rollback
            console.error("Error reordering favorites:", error);
            showToast.error("Failed to reorder");
        }
    }, [user, favorites]);

    return { favorites, loading, loadFavorites, addFavorite, removeFavorite, reorderFavorites };
}
