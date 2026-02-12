"use client";

import ProfileFavoritesGrid from "@/components/profile/ProfileFavoritesGrid";

export default function ProfileSection({ userId }) {
    return (
        <div className="py-6">
            <ProfileFavoritesGrid userId={userId} />
        </div>
    );
}
