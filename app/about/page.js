import Link from "next/link";
import { Film, Star, BookOpen, Users, TrendingUp, Heart } from "lucide-react";

export const metadata = {
    title: "About - ViewNote",
    description: "Learn about ViewNote — your personal media tracking, rating, and reviewing platform.",
};

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-background pt-24 pb-16">
            <div className="site-container max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-black mb-4">About ViewNote</h1>
                <p className="text-lg text-textSecondary mb-12">
                    Your personal space to track, rate, and review every movie and TV show you experience.
                </p>

                <section className="space-y-8 mb-16">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <Film size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Track Everything</h2>
                            <p className="text-textSecondary">
                                Log every movie, series, season, and episode you watch. Mark items as watched, paused, dropped, or add them to your watchlist. Keep a complete diary of your viewing history with dates and rewatch counts.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <Star size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Rate Honestly</h2>
                            <p className="text-textSecondary">
                                Rate on a half-star scale from 0.5 to 5. See your personal rating distribution, average ratings, and how your taste compares. Filter your graphs by movies, shows, seasons, or episodes.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <BookOpen size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Write Reviews</h2>
                            <p className="text-textSecondary">
                                Share your thoughts with detailed reviews. Mark spoiler content, like and comment on other reviews. Your reviews are attached to your profile and visible to the community.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <Heart size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Curate Favorites</h2>
                            <p className="text-textSecondary">
                                Build custom lists, pin your favorite movies, shows, and episodes to your profile. Import your existing library from Letterboxd. Make your profile uniquely yours.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <TrendingUp size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Discover What&apos;s Worth Watching</h2>
                            <p className="text-textSecondary">
                                Browse trending, popular, and hidden gem recommendations. See what&apos;s in cinemas, what&apos;s coming soon, and find binge-worthy shows — all powered by TMDB data.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <Users size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Community-Driven</h2>
                            <p className="text-textSecondary">
                                ViewNote is built for film lovers by film lovers. Every feature is designed to help you enjoy media on your own terms — no ads, no noise, just your personal media journal.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="bg-secondary rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-textSecondary">
                        This product uses the{" "}
                        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">TMDB</a>{" "}
                        API but is not endorsed or certified by TMDB. All movie and TV data is provided by The Movie Database.
                    </p>
                </div>
            </div>
        </main>
    );
}
