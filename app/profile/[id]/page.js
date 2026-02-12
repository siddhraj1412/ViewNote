"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRatings } from "@/hooks/useRatings";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ProfileBio from "@/components/profile/ProfileBio";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ErrorBoundary from "@/components/ErrorBoundary";
import AvatarUploadModal from "@/components/AvatarUploadModal";
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

function ProfilePageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { watchlist, loading: watchlistLoading } = useWatchlist();
    const { ratings, loading: ratingsLoading } = useRatings();

    const profileUserId = params.id;

    // Read tab from URL, default to "profile"
    const tabFromUrl = searchParams.get("tab") || "profile";
    const [activeSection, setActiveSection] = useState(tabFromUrl);

    const [bannerUrl, setBannerUrl] = useState(null);
    const [bannerAspectRatio, setBannerAspectRatio] = useState(2.5);
    const [profileData, setProfileData] = useState(null);
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    // Sync tab state when URL changes (back/forward button)
    useEffect(() => {
        const tab = searchParams.get("tab") || "profile";
        setActiveSection(tab);
    }, [searchParams]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    // Load profile data and banner for the profile being viewed
    useEffect(() => {
        if (profileUserId) {
            loadProfile();
        }
    }, [profileUserId]);

    const loadProfile = async () => {
        try {
            const profileRef = doc(db, "user_profiles", profileUserId);
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
                const data = profileSnap.data();
                setProfileData(data);
                const url = data.profile_banner_url;

                if (url) {
                    const img = new Image();
                    img.onload = () => {
                        const ratio = img.width / img.height;
                        setBannerAspectRatio(ratio);
                        setBannerUrl(url);
                    };
                    img.onerror = () => {
                        setTimeout(() => {
                            const retryImg = new Image();
                            retryImg.onload = () => {
                                const ratio = retryImg.width / retryImg.height;
                                setBannerAspectRatio(ratio);
                                setBannerUrl(url);
                            };
                            retryImg.onerror = () => setBannerUrl(null);
                            retryImg.src = url;
                        }, 1000);
                    };
                    img.src = url;
                } else {
                    setBannerUrl(null);
                }
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            setBannerUrl(null);
        }
    };

    // Tab change → update URL without full reload
    const handleSectionChange = useCallback((section) => {
        setActiveSection(section);
        const newUrl = section === "profile"
            ? `/profile/${profileUserId}`
            : `/profile/${profileUserId}?tab=${section}`;
        router.replace(newUrl, { scroll: false });
    }, [profileUserId, router]);

    const renderSection = () => {
        switch (activeSection) {
            case "profile":
                return <ProfileSection userId={profileUserId} />;
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
                return <ProfileSection userId={profileUserId} />;
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

    // Display name: use profile data if available, else fall back to auth
    const displayName = profileData?.displayName || user.displayName || user.email?.split("@")[0];

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
                    <div className="absolute inset-0" style={{
                        background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)"
                    }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-background" />
                    <div className="absolute inset-0 bg-black/20" />
                </div>

                <div className="container mx-auto px-4 relative z-10" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div className="pb-8 pt-24">
                        <div className="flex items-center mb-4">
                            <div className="flex items-center gap-6">
                                <div
                                    className={`w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold border-4 border-background shadow-xl overflow-hidden relative group ${user?.uid === profileUserId ? "cursor-pointer" : ""}`}
                                    onClick={() => user?.uid === profileUserId && setShowAvatarModal(true)}
                                >
                                    {profileData?.profile_picture_url ? (
                                        <img src={profileData.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        user.email?.[0].toUpperCase()
                                    )}
                                    {user?.uid === profileUserId && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs text-white font-medium">Edit</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-4">
                                        <h1 className="text-4xl font-bold text-white drop-shadow-lg leading-none">
                                            {displayName}
                                        </h1>
                                        {user?.uid === profileUserId && (
                                            <button
                                                onClick={() => router.push("/settings")}
                                                className="px-3 py-1.5 btn-edit-profile-glass text-xs font-medium flex items-center gap-1.5 h-fit"
                                            >
                                                <span>Edit Profile</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-white/80 max-w-2xl">
                                        <ProfileBio userId={profileUserId} />
                                    </div>
                                </div>
                            </div>
                        </div>




                    </div>
                </div>
            </div>

            {/* Section Tabs + Content */}
            <div className="container mx-auto px-4 pt-2 pb-8">
                <ProfileTabs activeSection={activeSection} onSectionChange={handleSectionChange} />
                <ErrorBoundary>
                    {renderSection()}
                </ErrorBoundary>
            </div>

            {/* Avatar Upload Modal */}
            {showAvatarModal && (
                <AvatarUploadModal
                    isOpen={showAvatarModal}
                    onClose={() => setShowAvatarModal(false)}
                    userId={user.uid}
                    currentAvatar={profileData?.profile_picture_url}
                    onUploadSuccess={(url) => {
                        setProfileData(prev => ({ ...prev, profile_picture_url: url }));
                        // Force refresh user context if needed, but local update serves immediate feedback
                    }}
                />
            )}
        </main>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        }>
            <ProfilePageContent />
        </Suspense>
    );
}
