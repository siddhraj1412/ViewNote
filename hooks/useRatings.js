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

export function useRatings() {
    const { user } = useAuth();
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);

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
                }));
                setRatings(items);
            } catch (error) {
                console.error("Error fetching ratings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRatings();
    }, [user]);

    const getRating = (mediaId) => {
        const rating = ratings.find((r) => r.mediaId === mediaId);
        return rating ? rating.rating : null;
    };

    const setRating = async (mediaId, mediaType, rating, title, poster_path) => {
        if (!user) throw new Error("User not authenticated");

        try {
            const existingRating = ratings.find((r) => r.mediaId === mediaId);

            if (existingRating) {
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
                const docRef = await addDoc(collection(db, "ratings"), {
                    userId: user.uid,
                    mediaId,
                    mediaType,
                    rating,
                    title,
                    poster_path,
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
