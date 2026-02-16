"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    serverTimestamp,
} from "firebase/firestore";
import eventBus from "@/lib/eventBus";
import showToast from "@/lib/toast";

export function useWatchlist() {
    const { user } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWatchlist = useCallback(async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, "user_watchlist"),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));
            setWatchlist(items);
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

    // Re-fetch when watchlist changes externally
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

        try {
            const docRef = await addDoc(collection(db, "user_watchlist"), {
                userId: user.uid,
                mediaId,
                mediaType,
                title,
                poster_path,
                addedAt: serverTimestamp(),
            });

            const newItem = {
                id: docRef.id,
                userId: user.uid,
                mediaId,
                mediaType,
                title,
                poster_path,
                addedAt: new Date(),
            };

            setWatchlist(prev => [...prev, newItem]);
            return docRef.id;
        } catch (error) {
            console.error("Error adding to watchlist:", error);
            throw error;
        }
    };

    const removeFromWatchlist = async (mediaId) => {
        if (!user) throw new Error("User not authenticated");

        try {
            const item = watchlist.find((i) => i.mediaId === mediaId);
            if (!item) return;

            await deleteDoc(doc(db, "user_watchlist", item.id));
            setWatchlist(prev => prev.filter((i) => i.mediaId !== mediaId));
        } catch (error) {
            console.error("Error removing from watchlist:", error);
            throw error;
        }
    };

    return {
        watchlist,
        loading,
        isInWatchlist,
        addToWatchlist,
        removeFromWatchlist,
    };
}
