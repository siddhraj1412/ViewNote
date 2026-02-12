"use client";

import ReviewsSection from "../ReviewsSection";

export default function ReviewsSectionTab({ userId, username }) {
    return (
        <div className="space-y-8">
            <ReviewsSection userId={userId} username={username} />
        </div>
    );
}
