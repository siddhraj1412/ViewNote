"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRatings } from "@/hooks/useRatings";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { RESERVED_ROUTES, getProfileUrl } from "@/lib/slugify";
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

function UsernameProfileContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { watchlist, loading: watchlistLoading } = useWatchlist();
    const { ratings, loading: ratingsLoading } = useRatings();

    const usernameParam = params.username;

    // Check if this is a reserved route — if so, show 404
    const isReserved = RESERVED_ROUTES.has(usernameParam?.toLowerCase());

    const [profileUserId, setProfileUserId] = useState(null);
    const [resolving, setResolving] = useState(true);

    const tabFromUrl = searchParams.get("tab") || "profile";
    const [activeSection, setActiveSection] = useState(tabFromUrl);

    const [bannerUrl, setBannerUrl] = useState(null);
    const [bannerAspectRatio, setBannerAspectRatio] = useState(2.5);
    const [profileData, setProfileData] = useState(null);
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    // Sync tab state when URL changes
    useEffect(() => {
        const tab = searchParams.get("tab") || "profile";
        setActiveSection(tab);
    }, [searchParams]);

    // Resolve username to Firebase UID
    useEffect(() => {
        if (isReserved) {
            setResolving(false);
            return;
        }

        const resolveUsername = async () => {
            setResolving(true);
            try {
                // Try looking up by username_lowercase
                const q = query(
                    collection(db, "user_profiles"),
                    where("username_lowercase", "==", usernameParam.toLowerCase())
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const userDoc = snap.docs[0];
                    setProfileUserId(userDoc.id);
                    const data = userDoc.data();
                    setProfileData(data);
                    loadBanner(data.profile_banner_url);
                    document.title = `${data.display_name || data.username || usernameParam} (@${data.username || usernameParam}) — ViewNote`;
                } else {
                    // Fallback: try treating the param as a UID (backward compat)
                    try {
                        const uidDoc = await getDoc(doc(db, "user_profiles", usernameParam));
                        if (uidDoc.exists()) {
                            const data = uidDoc.data();
                            setProfileUserId(usernameParam);
                            setProfileData(data);
                            loadBanner(data.profile_banner_url);
                            // If user has a username, redirect to the username URL
                            if (data.username) {
                                const tab = searchParams.get("tab");
                                router.replace(getProfileUrl(data.username, tab));
                                return;
                            }
                        } else {
                            setProfileUserId(null);
                        }
                    } catch {
                        setProfileUserId(null);
                    }
                }
            } catch (error) {
                console.error("Error resolving username:", error);
                setProfileUserId(null);
            } finally {
                setResolving(false);
            }
        };

        if (usernameParam) {
            resolveUsername();
        }
    }, [usernameParam]);

    const loadBanner = (url) => {
        if (url) {
            const img = new window.Image();
            img.onload = () => {
                const ratio = img.width / img.height;
                setBannerAspectRatio(ratio);
                setBannerUrl(url);
            };
            img.onerror = () => {
                setTimeout(() => {
                    const retryImg = new window.Image();
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
    };

    const handleSectionChange = useCallback((section) => {
        setActiveSection(section);
        const displayUsername = profileData?.username || usernameParam;
        const newUrl = section === "profile"
            ? `/${displayUsername}`
            : `/${displayUsername}?tab=${section}`;
        router.replace(newUrl, { scroll: false });
    }, [profileData, usernameParam, router]);

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

    if (isReserved) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Page not found</div>
            </div>
        );
    }

    if (authLoading || resolving || watchlistLoading || ratingsLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!profileUserId) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">User not found</h1>
                    <p className="text-textSecondary">No user with username &quot;{usernameParam}&quot; exists.</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">Sign in required</h1>
                    <p className="text-textSecondary">Please sign in to view profiles.</p>
                </div>
            </div>
        );
    }

    const displayName = profileData?.displayName || user.displayName || user.email?.split("@")[0];
    const isOwnProfile = user?.uid === profileUserId;

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
                                    className={`w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold border-4 border-background shadow-xl overflow-hidden relative group ${isOwnProfile ? "cursor-pointer" : ""}`}
                                    onClick={() => isOwnProfile && setShowAvatarModal(true)}
                                >
                                    {profileData?.profile_picture_url ? (
                                        <img src={profileData.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        user.email?.[0].toUpperCase()
                                    )}
                                    {isOwnProfile && (
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
                                        {isOwnProfile && (
                                            <button
                                                onClick={() => router.push("/settings")}
                                                className="px-3 py-1.5 btn-edit-profile-glass text-xs font-medium flex items-center gap-1.5 h-fit"
                                            >
                                                <span>Edit Profile</span>
                                            </button>
                                        )}
                                    </div>
                                    {profileData?.username && (
                                        <p className="text-white/50 text-sm">@{profileData.username}</p>
                                    )}
                                    <div className="text-white/80 max-w-2xl">
                                        <ProfileBio userId={profileUserId} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 pt-2 pb-8">
                <ProfileTabs activeSection={activeSection} onSectionChange={handleSectionChange} />
                <ErrorBoundary>
                    {renderSection()}
                </ErrorBoundary>
            </div>

            {showAvatarModal && (
                <AvatarUploadModal
                    isOpen={showAvatarModal}
                    onClose={() => setShowAvatarModal(false)}
                    userId={user.uid}
                    currentAvatar={profileData?.profile_picture_url}
                    onUploadSuccess={(url) => {
                        setProfileData(prev => ({ ...prev, profile_picture_url: url }));
                    }}
                />
            )}
        </main>
    );
}

export default function UsernameProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        }>
            <UsernameProfileContent />
        </Suspense>
    );
}
