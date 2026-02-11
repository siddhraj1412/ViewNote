"use client";

import MediaGrid from "@/components/MediaGrid";
import { MessageSquare } from "lucide-react";

export default function ReviewsSection() {
    return (
        <section>
            <h2 className="text-3xl font-bold mb-6">Reviews</h2>

            <div className="text-center py-12">
                <MessageSquare size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                <p className="text-textSecondary mb-2">No reviews yet</p>
                <p className="text-sm text-textSecondary opacity-70">
                    Write reviews for movies and TV shows to see them here
                </p>
            </div>
        </section>
    );
}
