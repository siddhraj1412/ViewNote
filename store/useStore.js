import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Event emitter for cross-component communication
const eventEmitter = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    },
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach((callback) => callback(data));
    },
};

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

            // Event emitter
            events: eventEmitter,

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
                eventEmitter.emit("CUSTOMIZATION_UPDATED", {
                    mediaId,
                    mediaType,
                    data,
                });

                // Emit profile update event
                eventEmitter.emit("PROFILE_UPDATED", {
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

                // Emit event
                eventEmitter.emit("CUSTOMIZATION_UPDATED", {
                    mediaId,
                    mediaType,
                    data: null,
                });
            },

            // Optimistic update tracking
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

            // Rating methods
            setRating: (mediaId, mediaType, rating) => {
                set((state) => ({
                    ratings: {
                        ...state.ratings,
                        [`${mediaType}_${mediaId}`]: rating,
                    },
                }));

                eventEmitter.emit("PROFILE_UPDATED", {
                    type: "rating",
                    mediaId,
                    mediaType,
                    rating,
                });
            },

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

                eventEmitter.emit("PROFILE_UPDATED", {
                    type: "watchlist",
                    action: "add",
                    mediaId,
                    mediaType,
                });
            },

            removeFromWatchlist: (mediaId, mediaType) => {
                set((state) => {
                    const newWatchlist = { ...state.watchlist };
                    delete newWatchlist[`${mediaType}_${mediaId}`];
                    return { watchlist: newWatchlist };
                });

                eventEmitter.emit("PROFILE_UPDATED", {
                    type: "watchlist",
                    action: "remove",
                    mediaId,
                    mediaType,
                });
            },

            isInWatchlist: (mediaId, mediaType) => {
                return !!get().watchlist[`${mediaType}_${mediaId}`];
            },

            // Clear all state
            clearAll: () => {
                set({
                    customizations: {},
                    ratings: {},
                    watchlist: {},
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

// Cross-tab sync via storage event
if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
        if (e.key === "viewnote-storage" && e.newValue) {
            try {
                const newState = JSON.parse(e.newValue);
                const currentState = useStore.getState();

                // Update store if changed
                if (JSON.stringify(newState.state.customizations) !== JSON.stringify(currentState.customizations)) {
                    useStore.setState({ customizations: newState.state.customizations });
                    eventEmitter.emit("CUSTOMIZATION_UPDATED", { source: "cross-tab" });
                }

                if (JSON.stringify(newState.state.ratings) !== JSON.stringify(currentState.ratings)) {
                    useStore.setState({ ratings: newState.state.ratings });
                    eventEmitter.emit("PROFILE_UPDATED", { source: "cross-tab", type: "rating" });
                }

                if (JSON.stringify(newState.state.watchlist) !== JSON.stringify(currentState.watchlist)) {
                    useStore.setState({ watchlist: newState.state.watchlist });
                    eventEmitter.emit("PROFILE_UPDATED", { source: "cross-tab", type: "watchlist" });
                }
            } catch (error) {
                console.error("Error syncing cross-tab state:", error);
            }
        }
    });
}
