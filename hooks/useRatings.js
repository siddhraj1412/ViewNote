"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";
import showToast from "@/lib/toast";

export function useRatings() {
    const { user } = useAuth();
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRatings = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from("user_ratings")
                .select("*")
                .eq("userId", user.uid);

            if (error) throw error;
            setRatings(data || []);
        } catch (error) {
            console.error("Error fetching ratings:", error);
            showToast.error("Failed to load your ratings");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setRatings([]);
            setLoading(false);
            return;
        }
        fetchRatings();
    }, [user, fetchRatings]);

    useEffect(() => {
        const handler = () => fetchRatings();
        // Delay refetch on MEDIA_UPDATED to allow Supabase write propagation
        const delayedHandler = () => setTimeout(fetchRatings, 300);
        eventBus.on("MEDIA_UPDATED", delayedHandler);
        eventBus.on("RATINGS_SNAPSHOT", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", delayedHandler);
            eventBus.off("RATINGS_SNAPSHOT", handler);
        };
    }, [fetchRatings]);

    const getRating = (mediaId) => {
        const rating = ratings.find((r) => r.mediaId === mediaId);
        return rating ? rating.rating : null;
    };

    const setRating = async (mediaId, mediaType, rating, title, poster_path) => {
        if (!user) throw new Error("User not authenticated");

        const existingRating = ratings.find((r) => r.mediaId === mediaId);
        const id = existingRating?.id || `${user.uid}_${mediaType}_${mediaId}`;
        const now = new Date().toISOString();

        // Optimistic update — update UI immediately
        const optimisticRating = existingRating
            ? { ...existingRating, rating, ratedAt: now }
            : { id, userId: user.uid, mediaId, mediaType, rating, title, poster_path, watched: true, ratedAt: now };

        const previousRatings = [...ratings];
        setRatings(prev =>
            existingRating
                ? prev.map((r) => r.mediaId === mediaId ? optimisticRating : r)
                : [...prev, optimisticRating]
        );

        try {
            if (existingRating) {
                const { error } = await supabase
                    .from("user_ratings")
                    .update({ rating, ratedAt: now })
                    .eq("id", existingRating.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("user_ratings").upsert(optimisticRating);
                if (error) throw error;
            }
        } catch (error) {
            // Rollback on failure
            setRatings(previousRatings);
            console.error("Error setting rating:", error);
            throw error;
        }
    };

    return { ratings, loading, getRating, setRating };
}
