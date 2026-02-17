"use client";

import { useState, useEffect, useCallback } from "react";
import supabase from "@/lib/supabase";
import ProfileFavoritesGrid from "@/components/profile/ProfileFavoritesGrid";
import UserRatingDistribution from "@/components/profile/UserRatingDistribution";
import RecentActivity from "@/components/profile/RecentActivity";

export default function ProfileSection({ userId }) {
    const [hasRatings, setHasRatings] = useState(null);

    useEffect(() => {
        if (!userId) return;
        const check = async () => {
            try {
                const { data, error } = await supabase
                    .from("user_ratings")
                    .select("id")
                    .eq("userId", userId)
                    .limit(1);
                setHasRatings(!error && data && data.length > 0);
            } catch {
                setHasRatings(false);
            }
        };
        check();
    }, [userId]);

    return (
        <div className="py-6 space-y-8">
            {/* Rating distribution + favorites side by side on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
                <UserRatingDistribution userId={userId} />
                <ProfileFavoritesGrid userId={userId} />
            </div>
            {/* Recent Activity */}
            <RecentActivity userId={userId} />
        </div>
    );
}
