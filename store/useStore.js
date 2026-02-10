import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Global state store using Zustand
 * Handles user customization, ratings, watchlist, and optimistic updates
 */

export const useStore = create(
    persist(
        (set, get) => ({
            // User customization state
            customizations: {},

            // Set customization for a specific media
            setCustomization: (mediaId, mediaType, data) => {
                set((state) => ({
                    customizations: {
                        ...state.customizations,
                        [`${mediaType}_${mediaId}`]: {
                            ...state.customizations[`${mediaType}_${mediaId}`],
                            ...data,
                            updatedAt: new Date().toISOString(),
                        },
                    },
                }));
            },

            // Get customization for a specific media
            getCustomization: (mediaId, mediaType) => {
                return get().customizations[`${mediaType}_${mediaId}`] || null;
            },

            // Clear customization
            clearCustomization: (mediaId, mediaType) => {
                set((state) => {
                    const newCustomizations = { ...state.customizations };
                    delete newCustomizations[`${mediaType}_${mediaId}`];
                    return { customizations: newCustomizations };
                });
            },

            // Ratings state
            ratings: {},

            setRating: (mediaId, mediaType, rating) => {
                set((state) => ({
                    ratings: {
                        ...state.ratings,
                        [`${mediaType}_${mediaId}`]: {
                            rating,
                            updatedAt: new Date().toISOString(),
                        },
                    },
                }));
            },

            getRating: (mediaId, mediaType) => {
                return get().ratings[`${mediaType}_${mediaId}`]?.rating || null;
            },

            // Watchlist state
            watchlist: [],

            addToWatchlist: (item) => {
                set((state) => ({
                    watchlist: [...state.watchlist.filter((i) => i.id !== item.id), item],
                }));
            },

            removeFromWatchlist: (itemId) => {
                set((state) => ({
                    watchlist: state.watchlist.filter((i) => i.id !== itemId),
                }));
            },

            isInWatchlist: (itemId) => {
                return get().watchlist.some((i) => i.id === itemId);
            },

            // Optimistic update state
            pendingUpdates: {},

            startOptimisticUpdate: (key, data) => {
                set((state) => ({
                    pendingUpdates: {
                        ...state.pendingUpdates,
                        [key]: { data, timestamp: Date.now() },
                    },
                }));
            },

            completeOptimisticUpdate: (key) => {
                set((state) => {
                    const newPending = { ...state.pendingUpdates };
                    delete newPending[key];
                    return { pendingUpdates: newPending };
                });
            },

            rollbackOptimisticUpdate: (key, previousData) => {
                set((state) => {
                    const newPending = { ...state.pendingUpdates };
                    delete newPending[key];
                    return { pendingUpdates: newPending };
                });
            },

            // Clear all state
            clearAll: () => {
                set({
                    customizations: {},
                    ratings: {},
                    watchlist: [],
                    pendingUpdates: {},
                });
            },
        }),
        {
            name: "viewnote-storage",
            storage: createJSONStorage(() => localStorage),
        }
    )
);
