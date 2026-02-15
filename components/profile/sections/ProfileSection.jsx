"use client";

import ProfileFavoritesGrid from "@/components/profile/ProfileFavoritesGrid";
import UserRatingDistribution from "@/components/profile/UserRatingDistribution";

export default function ProfileSection({ userId }) {
    return (
        <div className="py-6 space-y-8">
            {/* Rating distribution prominently at top */}
            <UserRatingDistribution userId={userId} />
            {/* Favorites below */}
            <ProfileFavoritesGrid userId={userId} />
        </div>
    );
}
