"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import Button from "@/components/ui/Button";
import RatingModal from "@/components/RatingModal";
import { Star, Plus, Check, Calendar, Tv as TvIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRatings } from "@/hooks/useRatings";
import { useToast } from "@/context/ToastContext";

export default function TVDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const tvId = Number(params.id);
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [watchlistLoading, setWatchlistLoading] = useState(false);

    const { user } = useAuth();
    const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
    const { getRating } = useRatings();
    const { showToast } = useToast();

    const inWatchlist = isInWatchlist(tvId);
    const userRating = getRating(tvId);

    useEffect(() => {
        const fetchShow = async () => {
            try {
                const data = await tmdb.getTVDetails(tvId);
                setShow(data);
            } catch (error) {
                console.error("Error fetching TV show:", error);
                showToast("Failed to load TV show details", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchShow();
    }, [tvId, showToast]);

    const handleWatchlistToggle = async () => {
        if (!user) {
            router.push("/login");
            return;
        }

        setWatchlistLoading(true);
        try {
            if (inWatchlist) {
                await removeFromWatchlist(tvId);
                showToast("Removed from watchlist", "success");
            } else {
                await addToWatchlist(tvId, "tv", show.name, show.poster_path);
                showToast("Added to watchlist", "success");
            }
        } catch (error) {
            showToast("Failed to update watchlist", "error");
        } finally {
            setWatchlistLoading(false);
        }
    };

    const handleRateClick = () => {
        if (!user) {
            router.push("/login");
            return;
        }
        setRatingModalOpen(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!show) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-4">TV show not found</h1>
                    <Link href="/" className="text-accent hover:underline">
                        Go back home
                    </Link>
                </div>
            </div>
        );
    }

    const creator = show.created_by?.[0];
    const cast = show.credits?.cast?.slice(0, 10) || [];

    return (
        <main className="min-h-screen bg-background">
            <div className="relative h-[60vh] overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src={tmdb.getBannerUrl(show.backdrop_path, show.poster_path)}
                        alt={show.name || "TV show banner"}
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-40 relative z-10">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-shrink-0">
                        <div className="relative w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                            <Image
                                src={tmdb.getImageUrl(show.poster_path)}
                                alt={show.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>

                    <div className="flex-1">
                        <h1 className="text-5xl font-bold mb-4">{show.name}</h1>

                        <div className="flex flex-wrap items-center gap-4 text-textSecondary mb-6">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} />
                                <span>{show.first_air_date?.split("-")[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <TvIcon size={18} />
                                <span>{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-accent" fill="currentColor" />
                                <span>{show.vote_average?.toFixed(1)}/10</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {show.genres?.map((genre) => (
                                <span
                                    key={genre.id}
                                    className="bg-secondary px-3 py-1 rounded-full text-sm"
                                >
                                    {genre.name}
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-4 mb-8">
                            <Button
                                onClick={handleWatchlistToggle}
                                disabled={watchlistLoading}
                                variant={inWatchlist ? "secondary" : "primary"}
                            >
                                {watchlistLoading ? (
                                    "Loading..."
                                ) : inWatchlist ? (
                                    <>
                                        <Check size={18} className="mr-2" />
                                        In Watchlist
                                    </>
                                ) : (
                                    <>
                                        <Plus size={18} className="mr-2" />
                                        Add to Watchlist
                                    </>
                                )}
                            </Button>
                            <Button variant="secondary" onClick={handleRateClick}>
                                <Star size={18} className="mr-2" />
                                {userRating ? `Rated ${userRating}/5` : "Rate"}
                            </Button>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold mb-3">Overview</h2>
                            <p className="text-textSecondary leading-relaxed">{show.overview}</p>
                        </div>

                        {creator && (
                            <div className="mb-4">
                                <span className="text-textSecondary">Created by: </span>
                                <Link
                                    href={`/person/${creator.id}`}
                                    className="font-semibold hover:text-accent transition"
                                >
                                    {creator.name}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {cast.length > 0 && (
                    <section className="mt-12">
                        <h2 className="text-3xl font-bold mb-6">Cast</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
                            {cast.map((person) => (
                                <Link
                                    key={person.id}
                                    href={`/person/${person.id}`}
                                    className="group text-center"
                                >
                                    <div className="relative aspect-square rounded-full overflow-hidden mb-2">
                                        <Image
                                            src={tmdb.getImageUrl(person.profile_path, "w200", "profile")}
                                            alt={person.name || "Cast member"}
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform"
                                        />
                                    </div>
                                    <p className="font-semibold text-sm line-clamp-1 group-hover:text-accent transition">
                                        {person.name}
                                    </p>
                                    <p className="text-xs text-textSecondary line-clamp-1">
                                        {person.character}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <RatingModal
                isOpen={ratingModalOpen}
                onClose={() => setRatingModalOpen(false)}
                mediaId={tvId}
                mediaType="tv"
                title={show.name}
                poster_path={show.poster_path}
                currentRating={userRating || 0}
            />
        </main>
    );
}
