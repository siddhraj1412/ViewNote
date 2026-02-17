"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";
import showToast from "@/lib/toast";

export function useUserActions() {
    const { user } = useAuth();
    const [actions, setActions] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchActions = useCallback(async () => {
        if (!user) {
            setActions({});
            setLoading(false);
            return;
        }

        try {
            const [watchedRes, watchlistRes, pausedRes, droppedRes] = await Promise.all([
                supabase.from("user_watched").select("mediaId").eq("userId", user.uid),
                supabase.from("user_watchlist").select("mediaId").eq("userId", user.uid),
                supabase.from("user_paused").select("mediaId").eq("userId", user.uid),
                supabase.from("user_dropped").select("mediaId").eq("userId", user.uid),
            ]);

            const actionsMap = {};

            (watchedRes.data || []).forEach((row) => {
                actionsMap[row.mediaId] = { ...actionsMap[row.mediaId], watched: true };
            });
            (watchlistRes.data || []).forEach((row) => {
                actionsMap[row.mediaId] = { ...actionsMap[row.mediaId], saved: true };
            });
            (pausedRes.data || []).forEach((row) => {
                actionsMap[row.mediaId] = { ...actionsMap[row.mediaId], paused: true };
            });
            (droppedRes.data || []).forEach((row) => {
                actionsMap[row.mediaId] = { ...actionsMap[row.mediaId], dropped: true };
            });

            setActions(actionsMap);
        } catch (error) {
            console.error("Error fetching user actions:", error);
            showToast.error("Failed to load your activity data");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchActions();
    }, [fetchActions]);

    const getAction = useCallback(
        (mediaId) => actions[mediaId] || {},
        [actions]
    );

    const isWatched = useCallback(
        (mediaId) => actions[mediaId]?.watched || false,
        [actions]
    );

    const isSaved = useCallback(
        (mediaId) => actions[mediaId]?.saved || false,
        [actions]
    );

    const isPaused = useCallback(
        (mediaId) => actions[mediaId]?.paused || false,
        [actions]
    );

    const isDropped = useCallback(
        (mediaId) => actions[mediaId]?.dropped || false,
        [actions]
    );

    return { actions, loading, getAction, isWatched, isSaved, isPaused, isDropped, refetch: fetchActions };
}
