"use client";

import { useEffect, useState } from "react";
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

export interface Rating {
    id: string;
    userId: string;
    mediaId: number;
    mediaType: "movie" | "tv";
    rating: number; // 0-5 with 0.5 increments
    title: string;
    poster_path: string | null;
    ratedAt: any;
}

export function useRatings() {
    const { user } = useAuth();
    const [ratings, setRatings] = useState<Rating[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch ratings
    useEffect(() => {
        if (!user) {
            setRatings([]);
            setLoading(false);
            return;
        }

        const fetchRatings = async () => {
            try {
                const q = query(
                    collection(db, "ratings"),
                    where("userId", "==", user.uid)
                );
                const snapshot = await getDocs(q);
                const items = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Rating[];
                setRatings(items);
            } catch (error) {
                console.error("Error fetching ratings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRatings();
    }, [user]);

    // Get rating for specific media
    const getRating = (mediaId: number): number | null => {
        const rating = ratings.find((r) => r.mediaId === mediaId);
        return rating ? rating.rating : null;
    };

    // Add or update rating
    const setRating = async (
        mediaId: number,
        mediaType: "movie" | "tv",
        rating: number,
        title: string,
        poster_path: string | null
    ) => {
        if (!user) throw new Error("User not authenticated");

        try {
            const existingRating = ratings.find((r) => r.mediaId === mediaId);

            if (existingRating) {
                // Update existing rating
                await updateDoc(doc(db, "ratings", existingRating.id), {
                    rating,
                    ratedAt: serverTimestamp(),
                });

                setRatings(
                    ratings.map((r) =>
                        r.mediaId === mediaId ? { ...r, rating, ratedAt: new Date() } : r
                    )
                );
            } else {
                // Add new rating
                const docRef = await addDoc(collection(db, "ratings"), {
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    rating,
                    title,
                    poster_path,
                    ratedAt: serverTimestamp(),
                });

                const newRating: Rating = {
                    id: docRef.id,
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    rating,
                    title,
                    poster_path,
                    ratedAt: new Date(),
                };

                setRatings([...ratings, newRating]);
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
