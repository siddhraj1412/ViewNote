"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRatings } from "@/hooks/useRatings";
import Card from "@/components/ui/Card";
import { Film, Star, Calendar } from "lucide-react";

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { watchlist, loading: watchlistLoading } = useWatchlist();
    const { ratings, loading: ratingsLoading } = useRatings();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    if (authLoading || watchlistLoading || ratingsLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12">
                {/* User Header */}
                <div className="mb-12">
                    <div className="flex items-center gap-6 mb-6">
                        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold">
                            {user.email?.[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold mb-2">
                                {user.displayName || user.email?.split("@")[0]}
                            </h1>
                            <p className="text-textSecondary">{user.email}</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-accent mb-1">
                                    {watchlist.length}
                                </div>
                                <div className="text-sm text-textSecondary">Watchlist</div>
                            </div>
                        </Card>
                        <Card>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-accent mb-1">
                                    {ratings.length}
                                </div>
                                <div className="text-sm text-textSecondary">Rated</div>
                            </div>
                        </Card>
                        <Card>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-accent mb-1">0</div>
                                <div className="text-sm text-textSecondary">Reviews</div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Watchlist Section */}
                <section className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <Film className="text-accent" size={28} />
                        <h2 className="text-3xl font-bold">My Watchlist</h2>
                    </div>

                    {watchlist.length === 0 ? (
                        <Card>
                            <div className="text-center py-12">
                                <Film className="mx-auto mb-4 text-textSecondary" size={48} />
                                <p className="text-xl text-textSecondary mb-4">
                                    Your watchlist is empty
                                </p>
                                <Link
                                    href="/search"
                                    className="text-accent hover:underline"
                                >
                                    Start adding movies and shows
                                </Link>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {watchlist.map((item) => (
                                <Link
                                    key={item.id}
                                    href={`/${item.mediaType}/${item.mediaId}`}
                                    className="group"
                                >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2">
                                        <Image
                                            src={tmdb.getImageUrl(item.poster_path)}
                                            alt={item.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform"
                                        />
                                    </div>
                                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition">
                                        {item.title}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Ratings Section */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <Star className="text-accent" size={28} />
                        <h2 className="text-3xl font-bold">My Ratings</h2>
                    </div>

                    {ratings.length === 0 ? (
                        <Card>
                            <div className="text-center py-12">
                                <Star className="mx-auto mb-4 text-textSecondary" size={48} />
                                <p className="text-xl text-textSecondary mb-4">
                                    You haven't rated anything yet
                                </p>
                                <Link
                                    href="/"
                                    className="text-accent hover:underline"
                                >
                                    Explore trending content
                                </Link>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {ratings.map((item) => (
                                <Card key={item.id} hover>
                                    <Link href={`/${item.mediaType}/${item.mediaId}`}>
                                        <div className="flex gap-4">
                                            <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0">
                                                <Image
                                                    src={tmdb.getImageUrl(item.poster_path)}
                                                    alt={item.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg mb-1">
                                                    {item.title}
                                                </h3>
                                                <div className="flex items-center gap-4 text-sm text-textSecondary">
                                                    <div className="flex items-center gap-1">
                                                        <Star size={16} className="text-accent" fill="currentColor" />
                                                        <span>{item.rating}/5</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Calendar size={16} />
                                                        <span>{item.ratedAt?.toDate ? item.ratedAt.toDate().toLocaleDateString() : "Recently"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
