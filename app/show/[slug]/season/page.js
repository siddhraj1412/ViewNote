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

    const [tv, setTv] = useState(null);
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
                    setTv(null);
                    return;
                }
                setTv(data);

                const correctShowUrl = getShowUrl(data);
                const currentShowPath = `/show/${rawSlug}`;
                if (correctShowUrl !== currentShowPath) {
                    router.replace(`${correctShowUrl}/season`, { scroll: false });
                }
            } catch {
                setTv(null);
            } finally {
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

    if (!tv) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Show not found</div>
            </div>
        );
    }

    const seasons = Array.isArray(tv.seasons) ? tv.seasons.filter((s) => (s?.season_number ?? 0) >= 0) : [];

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="container py-10">
                <div className="flex items-start justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold">{tv.name}</h1>
                        <div className="text-sm text-textSecondary mt-2">All seasons</div>
                    </div>
                    <Link
                        href={getShowUrl(tv)}
                        className="px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back to show
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {seasons.map((s) => {
                        const href = `/show/${encodeURIComponent(rawSlug)}/season/${s.id}/${s.season_number}`;
                        const img = tmdb.getImageUrl(s.poster_path, "w500", "poster");
                        return (
                            <Link key={s.id} href={href} className="block group">
                                <div className="bg-secondary rounded-xl border border-white/5 overflow-hidden hover:border-white/10 transition-all">
                                    <div className="flex gap-4 p-4">
                                        <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden bg-white/5 shrink-0">
                                            <Image src={img} alt={s.name || "Season"} fill className="object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-lg font-bold text-white truncate">{s.name || `Season ${s.season_number}`}</div>
                                            <div className="text-xs text-textSecondary mt-1">Season {s.season_number}</div>
                                            {s.episode_count ? (
                                                <div className="text-xs text-textSecondary mt-1">{s.episode_count} episode{s.episode_count !== 1 ? "s" : ""}</div>
                                            ) : null}
                                            {s.overview ? (
                                                <div className="text-sm text-textSecondary mt-2 line-clamp-2">{s.overview}</div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
