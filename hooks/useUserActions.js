"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
} from "firebase/firestore";
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
            const q = query(
                collection(db, "user_actions"),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(q);
            const actionsMap = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                actionsMap[data.mediaId] = data;
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
        (mediaId) => {
            return actions[mediaId] || {};
        },
        [actions]
    );

    const isWatched = useCallback(
        (mediaId) => {
            return actions[mediaId]?.watched || false;
        },
        [actions]
    );

    const isSaved = useCallback(
        (mediaId) => {
            return actions[mediaId]?.saved || false;
        },
        [actions]
    );

    const isPaused = useCallback(
        (mediaId) => {
            return actions[mediaId]?.paused || false;
        },
        [actions]
    );

    const isDropped = useCallback(
        (mediaId) => {
            return actions[mediaId]?.dropped || false;
        },
        [actions]
    );

    return {
        actions,
        loading,
        getAction,
        isWatched,
        isSaved,
        isPaused,
        isDropped,
        refetch: fetchActions,
    };
}
