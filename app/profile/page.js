"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRatings } from "@/hooks/useRatings";
import Card from "@/components/ui/Card";
import { LogOut } from "lucide-react";
import FavoritesMatrix from "@/components/favorites/FavoritesMatrix";
import WatchedSection from "@/components/profile/WatchedSection";
import PausedSection from "@/components/profile/PausedSection";
import WatchingSection from "@/components/profile/WatchingSection";
import ReviewsSection from "@/components/profile/ReviewsSection";
import ListsSection from "@/components/profile/ListsSection";

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const { watchlist, loading: watchlistLoading } = useWatchlist();
    const { ratings, loading: ratingsLoading } = useRatings();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    const handleLogout = async () => {
        try {
            await logout();
            router.push("/");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

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
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-6">
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

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-white/10 rounded-lg transition"
                        >
                            <LogOut size={20} />
                            Logout
                        </button>
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

                {/* Favorites Matrix */}
                <div className="mb-16">
                    <FavoritesMatrix />
                </div>

                {/* Watched Section */}
                <div className="mb-16">
                    <WatchedSection watchedMovies={[]} watchedTV={[]} />
                </div>

                {/* Paused Section */}
                <div className="mb-16">
                    <PausedSection pausedMovies={[]} pausedTV={[]} />
                </div>

                {/* Watching Section */}
                <div className="mb-16">
                    <WatchingSection />
                </div>

                {/* Reviews Section */}
                <div className="mb-16">
                    <ReviewsSection />
                </div>

                {/* Lists Section */}
                <div className="mb-16">
                    <ListsSection />
                </div>
            </div>
        </main>
    );
}
