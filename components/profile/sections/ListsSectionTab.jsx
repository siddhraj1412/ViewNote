"use client";

import ListsSection from "../ListsSection";

export default function ListsSectionTab({ userId, isOwnProfile }) {
    return (
        <div className="space-y-8">
            <ListsSection ownerId={userId} isOwnProfile={isOwnProfile} />
        </div>
    );
}
