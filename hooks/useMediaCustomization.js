"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabase";

/**
 * Hook for media detail pages to get and subscribe to live customization updates.
 * Returns custom poster/banner if available, with live updates.
 *
 * PRIORITY: Default TMDB → Personal user override (isolated per user)
 * Personal overrides are scoped to the logged-in user only and never affect other users.
 */
export function useMediaCustomization(mediaId, mediaType, defaultPoster, defaultBanner, profileUserId) {
    const { user } = useAuth();
    const store = useStore();
    const [customPoster, setCustomPoster] = useState(defaultPoster);
    const [customBanner, setCustomBanner] = useState(defaultBanner);
    const [loading, setLoading] = useState(true);

    // Only show customizations for the logged-in user viewing their own content
    const ownerId = user?.uid;
    const shouldShowCustomization = ownerId && (!profileUserId || profileUserId === ownerId);

    // Track defaults in refs so effect doesn't re-fire when they change
    const defaultPosterRef = useRef(defaultPoster);
    const defaultBannerRef = useRef(defaultBanner);
    useEffect(() => {
        defaultPosterRef.current = defaultPoster;
        defaultBannerRef.current = defaultBanner;
        // Sync state if no custom value was ever set
        setCustomPoster((prev) => prev === defaultPosterRef.current || !prev ? defaultPoster : prev);
        setCustomBanner((prev) => prev === defaultBannerRef.current || !prev ? defaultBanner : prev);
    }, [defaultPoster, defaultBanner]);

    useEffect(() => {
        if (!shouldShowCustomization || !mediaId) {
            setCustomPoster(defaultPosterRef.current);
            setCustomBanner(defaultBannerRef.current);
            setLoading(false);
            return;
        }

        const prefId = `${ownerId}_${mediaType}_${mediaId}`;
        const dp = defaultPosterRef.current;
        const db = defaultBannerRef.current;

        // Initial fetch
        const loadCustomization = async () => {
            setLoading(true);
            try {
                // Check store first (for own profile)
                const storeCustomization = store.getCustomization(mediaId, mediaType);
                if (storeCustomization) {
                    setCustomPoster(storeCustomization.customPoster || dp);
                    setCustomBanner(storeCustomization.customBanner || db);
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from("user_media_preferences")
                    .select("*")
                    .eq("id", prefId)
                    .single();

                if (error && error.code !== "PGRST116") throw error;

                if (data) {
                    setCustomPoster(data.customPoster || dp);
                    setCustomBanner(data.customBanner || db);
                    store.setCustomization(mediaId, mediaType, {
                        customPoster: data.customPoster,
                        customBanner: data.customBanner,
                    });
                } else {
                    setCustomPoster(dp);
                    setCustomBanner(db);
                    store.setCustomization(mediaId, mediaType, { customPoster: null, customBanner: null });
                }
            } catch (error) {
                console.error("Customization load error:", error);
                setCustomPoster(dp);
                setCustomBanner(db);
            } finally {
                setLoading(false);
            }
        };

        loadCustomization();

        // Realtime subscription
        const channel = supabase
            .channel(`prefs_${prefId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "user_media_preferences",
                    filter: `id=eq.${prefId}`,
                },
                (payload) => {
                    if (payload.eventType === "DELETE") {
                        setCustomPoster(defaultPosterRef.current);
                        setCustomBanner(defaultBannerRef.current);
                        store.setCustomization(mediaId, mediaType, { customPoster: null, customBanner: null });
                    } else {
                        const data = payload.new;
                        setCustomPoster(data.customPoster || defaultPosterRef.current);
                        setCustomBanner(data.customBanner || defaultBannerRef.current);
                        store.setCustomization(mediaId, mediaType, {
                            customPoster: data.customPoster,
                            customBanner: data.customBanner,
                        });
                    }
                    setLoading(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shouldShowCustomization, ownerId, mediaId, mediaType]);

    return { customPoster, customBanner, loading };
}
