"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";
import showToast from "@/lib/toast";

export function useWatchlist() {
    const { user } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWatchlist = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from("user_watchlist")
                .select("*")
                .eq("userId", user.uid);

            if (error) throw error;
            setWatchlist(data || []);
        } catch (error) {
            console.error("Error fetching watchlist:", error);
            showToast.error("Failed to load your watchlist");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setWatchlist([]);
            setLoading(false);
            return;
        }
        fetchWatchlist();
    }, [user, fetchWatchlist]);

    useEffect(() => {
        const handler = () => fetchWatchlist();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("WATCHLIST_SNAPSHOT", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("WATCHLIST_SNAPSHOT", handler);
        };
    }, [fetchWatchlist]);

    const isInWatchlist = (mediaId) => {
        return watchlist.some((item) => item.mediaId === mediaId);
    };

    const addToWatchlist = async (mediaId, mediaType, title, poster_path) => {
        if (!user) throw new Error("User not authenticated");

        const id = `${user.uid}_${mediaType}_${mediaId}`;
        const newItem = {
            id,
            userId: user.uid,
            mediaId,
            mediaType,
            title,
            poster_path,
            addedAt: new Date().toISOString(),
        };

        // Optimistic update
        const previousWatchlist = [...watchlist];
        setWatchlist(prev => [...prev, newItem]);

        try {
            const { error } = await supabase.from("user_watchlist").upsert(newItem);
            if (error) throw error;
            return id;
        } catch (error) {
            setWatchlist(previousWatchlist); // Rollback
            console.error("Error adding to watchlist:", error);
            throw error;
        }
    };

    const removeFromWatchlist = async (mediaId) => {
        if (!user) throw new Error("User not authenticated");

        const item = watchlist.find((i) => i.mediaId === mediaId);
        if (!item) return;

        // Optimistic update
        const previousWatchlist = [...watchlist];
        setWatchlist(prev => prev.filter((i) => i.mediaId !== mediaId));

        try {
            const { error } = await supabase.from("user_watchlist").delete().eq("id", item.id);
            if (error) throw error;
        } catch (error) {
            setWatchlist(previousWatchlist); // Rollback
            console.error("Error removing from watchlist:", error);
            throw error;
        }
    };

    return { watchlist, loading, isInWatchlist, addToWatchlist, removeFromWatchlist };
}
