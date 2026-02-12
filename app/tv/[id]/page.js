"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { tmdb } from "@/lib/tmdb";
import { getShowUrl } from "@/lib/slugify";

/**
 * Legacy route: /tv/[id]
 * Redirects to new SEO-friendly URL: /show/{slug}-{id}
 */
export default function TVLegacyRedirect() {
    const params = useParams();
    const router = useRouter();
    const tvId = Number(params.id);

    useEffect(() => {
        if (!tvId || isNaN(tvId)) return;

        const redirect = async () => {
            try {
                const data = await tmdb.getTVDetails(tvId);
                if (data) {
                    router.replace(getShowUrl(data));
                    return;
                }
            } catch (e) {
                console.error("Legacy TV redirect failed:", e);
            }
            router.replace(`/show/show-${tvId}`);
        };

        redirect();
    }, [tvId, router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center pt-16">
            <div className="text-2xl text-textSecondary">Redirecting...</div>
        </div>
    );
}
