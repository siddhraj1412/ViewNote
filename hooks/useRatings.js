"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    serverTimestamp,
} from "firebase/firestore";
import eventBus from "@/lib/eventBus";

export function useRatings() {
    const { user } = useAuth();
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRatings = useCallback(async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, "user_ratings"),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));
            setRatings(items);
        } catch (error) {
            console.error("Error fetching ratings:", error);
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

    // Re-fetch when ratings change externally
    useEffect(() => {
        const handler = () => fetchRatings();
        eventBus.on("MEDIA_UPDATED", handler);
        eventBus.on("RATINGS_SNAPSHOT", handler);
        return () => {
            eventBus.off("MEDIA_UPDATED", handler);
            eventBus.off("RATINGS_SNAPSHOT", handler);
        };
    }, [fetchRatings]);

    const getRating = (mediaId) => {
        const rating = ratings.find((r) => r.mediaId === mediaId);
        return rating ? rating.rating : null;
    };

    const setRating = async (mediaId, mediaType, rating, title, poster_path) => {
        if (!user) throw new Error("User not authenticated");

        try {
            const existingRating = ratings.find((r) => r.mediaId === mediaId);

            if (existingRating) {
                await updateDoc(doc(db, "user_ratings", existingRating.id), {
                    rating,
                    ratedAt: serverTimestamp(),
                });

                setRatings(prev =>
                    prev.map((r) =>
                        r.mediaId === mediaId ? { ...r, rating, ratedAt: new Date() } : r
                    )
                );
            } else {
                const docRef = await addDoc(collection(db, "user_ratings"), {
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    rating,
                    title,
                    poster_path,
                    watched: true, // Auto-mark as watched when rating
                    ratedAt: serverTimestamp(),
                });

                const newRating = {
                    id: docRef.id,
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    rating,
                    title,
                    poster_path,
                    watched: true,
                    ratedAt: new Date(),
                };

                setRatings(prev => [...prev, newRating]);
            }
        } catch (error) {
            console.error("Error setting rating:", error);
            throw error;
        }
    };

    return {
        ratings,
        loading,
        getRating,
        setRating,
    };
}
