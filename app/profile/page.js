"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRatings } from "@/hooks/useRatings";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Settings } from "lucide-react";
import ProfileBio from "@/components/profile/ProfileBio";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ProfileSection from "@/components/profile/sections/ProfileSection";
import WatchingSection from "@/components/profile/sections/WatchingSection";
import WatchedSectionTab from "@/components/profile/sections/WatchedSectionTab";
import DiarySection from "@/components/profile/sections/DiarySection";
import ReviewsSectionTab from "@/components/profile/sections/ReviewsSectionTab";
import WatchlistSection from "@/components/profile/sections/WatchlistSection";
import ListsSectionTab from "@/components/profile/sections/ListsSectionTab";
import LikesSection from "@/components/profile/sections/LikesSection";
import PausedSectionTab from "@/components/profile/sections/PausedSectionTab";
import DroppedSection from "@/components/profile/sections/DroppedSection";

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const { watchlist, loading: watchlistLoading } = useWatchlist();
    const { ratings, loading: ratingsLoading } = useRatings();
    const [activeSection, setActiveSection] = useState("profile");
    const [bannerUrl, setBannerUrl] = useState(null);
    const [bannerAspectRatio, setBannerAspectRatio] = useState(2.5);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user?.uid) {
            loadBanner();
        }
    }, [user]);

    const loadBanner = async () => {
        try {
            const profileRef = doc(db, "user_profiles", user.uid);
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
                const data = profileSnap.data();
                const url = data.profile_banner_url;

                if (url) {
                    // Preload and detect aspect ratio
                    const img = new Image();
                    img.onload = () => {
                        const ratio = img.width / img.height;
                        setBannerAspectRatio(ratio);
                        setBannerUrl(url);
                    };
                    img.onerror = () => {
                        // Retry once after 1s
                        setTimeout(() => {
                            const retryImg = new Image();
                            retryImg.onload = () => {
                                const ratio = retryImg.width / retryImg.height;
                                setBannerAspectRatio(ratio);
                                setBannerUrl(url);
                            };
                            retryImg.onerror = () => {
                                setBannerUrl(null);
                            };
                            retryImg.src = url;
                        }, 1000);
                    };
                    img.src = url;
                } else {
                    setBannerUrl(null);
                }
            }
        } catch (error) {
            console.error("Error loading banner:", error);
            setBannerUrl(null);
        }
    };

    const handleSectionChange = (section) => {
        setActiveSection(section);
    };

    const renderSection = () => {
        switch (activeSection) {
            case "profile":
                return <ProfileSection userId={user.uid} />;
            case "watching":
                return <WatchingSection />;
            case "watched":
                return <WatchedSectionTab />;
            case "diary":
                return <DiarySection />;
            case "reviews":
                return <ReviewsSectionTab />;
            case "watchlist":
                return <WatchlistSection />;
            case "lists":
                return <ListsSectionTab />;
            case "likes":
                return <LikesSection />;
            case "paused":
                return <PausedSectionTab />;
            case "dropped":
                return <DroppedSection />;
            default:
                return <ProfileSection userId={user.uid} />;
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
            {/* Adaptive Hero Banner */}
            <div className="relative">
                <div
                    className="absolute top-0 left-0 right-0"
                    style={{
                        minHeight: "70vh",
                        maxHeight: "90vh",
                        height: "auto",
                        backgroundImage: bannerUrl
                            ? `url(${bannerUrl})`
                            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        backgroundSize: bannerAspectRatio > 2.1 ? "contain" : "cover",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                    }}
                >
                    {/* Soft Vignette */}
                    <div className="absolute inset-0" style={{
                        background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)"
                    }} />

                    {/* Bottom Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-background" />

                    {/* Text Contrast Layer */}
                    <div className="absolute inset-0 bg-black/20" />
                </div>

                <div className="container mx-auto px-4 relative z-10" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    {/* User Header */}
                    <div className="pb-8 pt-24">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold border-4 border-background shadow-xl">
                                    {user.email?.[0].toUpperCase()}
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                                        {user.displayName || user.email?.split("@")[0]}
                                    </h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => router.push("/settings")}
                                    className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition"
                                >
                                    <Settings size={20} />
                                    Settings
                                </button>
                            </div>
                        </div>

                        {/* Bio */}
                        <ProfileBio userId={user.uid} />

                        {/* Metrics Pills */}
                        <div className="flex gap-3 mt-3">
                            <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                <span className="text-accent font-bold">{watchlist.length}</span>
                                <span className="text-sm text-white/80">Watchlist</span>
                            </div>
                            <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                <span className="text-accent font-bold">{ratings.length}</span>
                                <span className="text-sm text-white/80">Rated</span>
                            </div>
                            <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                <span className="text-accent font-bold">0</span>
                                <span className="text-sm text-white/80">Reviews</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Tabs + Content — tight spacing */}
            <div className="container mx-auto px-4 pt-2 pb-8">
                <ProfileTabs activeSection={activeSection} onSectionChange={handleSectionChange} />
                {renderSection()}
            </div>
        </main>
    );
}
