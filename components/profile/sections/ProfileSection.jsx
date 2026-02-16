"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProfileFavoritesGrid from "@/components/profile/ProfileFavoritesGrid";
import UserRatingDistribution from "@/components/profile/UserRatingDistribution";
import RecentActivity from "@/components/profile/RecentActivity";

export default function ProfileSection({ userId }) {
    const [hasRatings, setHasRatings] = useState(null);

    useEffect(() => {
        if (!userId) return;
        const check = async () => {
            try {
                const q = query(
                    collection(db, "user_ratings"),
                    where("userId", "==", userId)
                );
                const snap = await getDocs(q);
                setHasRatings(snap.size > 0);
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
