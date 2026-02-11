import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import eventBus from "@/lib/eventBus";

export const useStore = create(
    persist(
        (set, get) => ({
            // Customizations state
            customizations: {},

            // Ratings state
            ratings: {},

            // Watchlist state
            watchlist: {},

            // Pending optimistic updates
            pendingUpdates: {},

            // Set customization
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

                // Emit event for live updates
                eventBus.emit("CUSTOMIZATION_UPDATED", {
                    mediaId,
                    mediaType,
                    data,
                });

                // Emit profile update event
                eventBus.emit("PROFILE_UPDATED", {
                    type: "customization",
                    mediaId,
                    mediaType,
                });
            },

            // Get customization
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

            // Set rating
            setRating: (mediaId, mediaType, rating) => {
                set((state) => ({
                    ratings: {
                        ...state.ratings,
                        [`${mediaType}_${mediaId}`]: rating,
                    },
                }));
            },

            // Get rating
            getRating: (mediaId, mediaType) => {
                return get().ratings[`${mediaType}_${mediaId}`] || null;
            },

            // Watchlist methods
            addToWatchlist: (mediaId, mediaType) => {
                set((state) => ({
                    watchlist: {
                        ...state.watchlist,
                        [`${mediaType}_${mediaId}`]: true,
                    },
                }));
            },

            removeFromWatchlist: (mediaId, mediaType) => {
                set((state) => {
                    const newWatchlist = { ...state.watchlist };
                    delete newWatchlist[`${mediaType}_${mediaId}`];
                    return { watchlist: newWatchlist };
                });
            },

            isInWatchlist: (mediaId, mediaType) => {
                return !!get().watchlist[`${mediaType}_${mediaId}`];
            },

            // Optimistic update tracking
            startOptimisticUpdate: (key, data) => {
                set((state) => ({
                    pendingUpdates: {
                        ...state.pendingUpdates,
                        [key]: {
                            data,
                            timestamp: Date.now(),
                        },
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

            rollbackOptimisticUpdate: (key) => {
                set((state) => {
                    const newPending = { ...state.pendingUpdates };
                    delete newPending[key];
                    return { pendingUpdates: newPending };
                });
            },
        }),
        {
            name: "viewnote-storage",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                customizations: state.customizations,
                ratings: state.ratings,
                watchlist: state.watchlist,
            }),
        }
    )
);

// Cross-tab synchronization
if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
        if (e.key === "viewnote-storage" && e.newValue) {
            try {
                const newState = JSON.parse(e.newValue);
                const currentState = useStore.getState();

                // Only update if state actually changed
                if (JSON.stringify(newState.state) !== JSON.stringify(currentState)) {
                    useStore.setState(newState.state);

                    // Emit events for cross-tab updates
                    eventBus.emit("PROFILE_UPDATED", {
                        type: "cross-tab-sync",
                    });
                }
            } catch (error) {
                console.error("Error syncing across tabs:", error);
            }
        }
    });
}
