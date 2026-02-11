"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, updateDoc } from "firebase/firestore";
import showToast from "@/lib/toast";

export function useFavorites() {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState({
        movies: [],
        shows: [],
        episodes: [],
    });
    const [loading, setLoading] = useState(false);

    // Load all favorites
    const loadFavorites = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const [moviesSnap, showsSnap, episodesSnap] = await Promise.all([
                getDocs(query(collection(db, "favorites_movies"), where("userId", "==", user.uid))),
                getDocs(query(collection(db, "favorites_shows"), where("userId", "==", user.uid))),
                getDocs(query(collection(db, "favorites_episodes"), where("userId", "==", user.uid))),
            ]);

            const moviesData = moviesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);
            const showsData = showsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);
            const episodesData = episodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);

            setFavorites({
                movies: moviesData,
                shows: showsData,
                episodes: episodesData,
            });
        } catch (error) {
            console.error("Error loading favorites:", error);
            showToast.error("Failed to load favorites");
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Add favorite
    const addFavorite = useCallback(async (type, media) => {
        if (!user) return;

        const collectionName = `favorites_${type}`;
        const currentList = favorites[type];

        if (currentList.length >= 5) {
            showToast.error(`Maximum 5 ${type} allowed`);
            return;
        }

        if (currentList.some(item => item.mediaId === media.id)) {
            showToast.error("Already in favorites");
            return;
        }

        try {
            const docRef = doc(db, collectionName, `${user.uid}_${media.id}`);
            const favoriteData = {
                userId: user.uid,
                mediaId: media.id,
                mediaType: type === "movies" ? "movie" : type === "shows" ? "tv" : "episode",
                title: media.title || media.name,
                poster_path: media.poster_path,
                release_date: media.release_date || media.first_air_date,
                order: currentList.length,
                createdAt: new Date().toISOString(),
            };

            await setDoc(docRef, favoriteData);

            setFavorites(prev => ({
                ...prev,
                [type]: [...prev[type], { id: docRef.id, ...favoriteData }],
            }));

            showToast.success(`Added to Favorite ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        } catch (error) {
            console.error("Error adding favorite:", error);
            showToast.error("Failed to add favorite");
        }
    }, [user, favorites]);

    // Remove favorite
    const removeFavorite = useCallback(async (type, id) => {
        if (!user) return;

        const collectionName = `favorites_${type}`;

        try {
            await deleteDoc(doc(db, collectionName, id));

            setFavorites(prev => ({
                ...prev,
                [type]: prev[type].filter(item => item.id !== id),
            }));

            showToast.success(`Removed from Favorite ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        } catch (error) {
            console.error("Error removing favorite:", error);
            showToast.error("Failed to remove favorite");
        }
    }, [user]);

    // Reorder favorites
    const reorderFavorites = useCallback(async (type, newOrder) => {
        if (!user) return;

        const collectionName = `favorites_${type}`;

        try {
            // Update order in Firestore
            const updatePromises = newOrder.map((item, index) =>
                updateDoc(doc(db, collectionName, item.id), { order: index })
            );

            await Promise.all(updatePromises);

            setFavorites(prev => ({
                ...prev,
                [type]: newOrder.map((item, index) => ({ ...item, order: index })),
            }));

            showToast.success("Reordered Favorites");
        } catch (error) {
            console.error("Error reordering favorites:", error);
            showToast.error("Failed to reorder");
        }
    }, [user]);

    return {
        favorites,
        loading,
        loadFavorites,
        addFavorite,
        removeFavorite,
        reorderFavorites,
    };
}
