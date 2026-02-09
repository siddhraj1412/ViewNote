"use client";

import { useEffect, useState } from "react";
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

export function useWatchlist() {
    const { user } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setWatchlist([]);
            setLoading(false);
            return;
        }

        const fetchWatchlist = async () => {
            try {
                const q = query(
                    collection(db, "watchlist"),
                    where("userId", "==", user.uid)
                );
                const snapshot = await getDocs(q);
                const items = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setWatchlist(items);
            } catch (error) {
                console.error("Error fetching watchlist:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchWatchlist();
    }, [user]);

    const isInWatchlist = (mediaId) => {
        return watchlist.some((item) => item.mediaId === mediaId);
    };

    const addToWatchlist = async (mediaId, mediaType, title, poster_path) => {
        if (!user) throw new Error("User not authenticated");

        try {
            const docRef = await addDoc(collection(db, "watchlist"), {
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

            setWatchlist([...watchlist, newItem]);
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

            await deleteDoc(doc(db, "watchlist", item.id));
            setWatchlist(watchlist.filter((i) => i.mediaId !== mediaId));
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
