"use client";

import { useState, useEffect } from "react";
import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";

export default function ProfileBio({ userId }) {
    const [bio, setBio] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            loadBio();
        }
    }, [userId]);

    useEffect(() => {
        const handleProfileUpdate = () => {
            loadBio();
        };

        if (eventBus && typeof eventBus.on === "function") {
            eventBus.on("PROFILE_UPDATED", handleProfileUpdate);
        }

        return () => {
            if (eventBus && typeof eventBus.off === "function") {
                eventBus.off("PROFILE_UPDATED", handleProfileUpdate);
            }
        };
    }, [userId]);

    const loadBio = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (data) {
                setBio(data.bio || "");
            }
        } catch (error) {
            console.error("Error loading bio:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return null;
    }

    if (!bio) {
        return null;
    }

    return (
        <div className="mb-2">
            <p className="text-textPrimary leading-relaxed whitespace-pre-wrap break-words" style={{ overflowWrap: "anywhere" }}>
                {bio}
            </p>
        </div>
    );
}
