"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { tmdb } from "@/lib/tmdb";
import { parseSlugId, getShowUrl } from "@/lib/slugify";

export default function ShowSeasonsPage() {
    const params = useParams();
    const router = useRouter();
    const rawSlug = decodeURIComponent(params.slug || "");
    const { id: tvId } = parseSlugId(rawSlug);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tvId) {
            setLoading(false);
            return;
        }

        const run = async () => {
            try {
                const data = await tmdb.getTVDetails(tvId);
                if (!data) {
                    setLoading(false);
                    return;
                }
                router.replace(getShowUrl(data), { scroll: false });
            } catch {
                setLoading(false);
            }
        };

        run();
    }, [tvId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-textSecondary">Redirecting…</div>
            </div>
        </main>
    );
}
