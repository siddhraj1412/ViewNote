"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, Image as ImageIcon, FileText, Film, Tv, Play, Palette } from "lucide-react";
import showToast from "@/lib/toast";
import SearchModal from "@/components/favorites/SearchModal";
import BannerSelectionModal from "@/components/settings/BannerSelectionModal";
import eventBus from "@/lib/eventBus";

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState({
        profile_picture_url: "",
        bio: "",
        favorite_movie_id: null,
        favorite_series_id: null,
        favorite_episode_id: null,
        profile_banner_url: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [searchType, setSearchType] = useState(null);
    const [bannerModalOpen, setBannerModalOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const profileRef = doc(db, "user_profiles", user.uid);
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
                setProfile(profileSnap.data());
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            showToast.error("Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async (updates) => {
        setSaving(true);
        try {
            const profileRef = doc(db, "user_profiles", user.uid);
            await setDoc(profileRef, { ...profile, ...updates, userId: user.uid }, { merge: true });

            setProfile((prev) => ({ ...prev, ...updates }));

            // Emit profile update event
            eventBus.emit("PROFILE_UPDATED", {
                type: "settings",
                updates,
            });

            showToast.success("Profile updated successfully");
        } catch (error) {
            console.error("Error saving profile:", error);
            showToast.error("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleBioChange = (e) => {
        const newBio = e.target.value;
        if (newBio.length <= 500) {
            setProfile((prev) => ({ ...prev, bio: newBio }));
        }
    };

    const handleBioSave = () => {
        saveProfile({ bio: profile.bio });
    };

    const handleFavoriteSelect = (item) => {
        if (searchType === "movie") {
            saveProfile({ favorite_movie_id: item.id });
        } else if (searchType === "tv") {
            saveProfile({ favorite_series_id: item.id });
        }
        setSearchModalOpen(false);
    };

    const openFavoriteSearch = (type) => {
        setSearchType(type);
        setSearchModalOpen(true);
    };

    const handleBannerSelect = (bannerUrl) => {
        saveProfile({ profile_banner_url: bannerUrl });
    };

    if (authLoading || loading) {
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
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <h1 className="text-4xl font-bold mb-8">Settings</h1>

                {/* Profile Picture */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <User className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Profile Picture</h2>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center text-4xl font-bold overflow-hidden">
                            {profile.profile_picture_url ? (
                                <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user.email?.[0].toUpperCase()
                            )}
                        </div>
                        <button
                            className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition"
                            onClick={() => showToast.info("Upload feature coming soon")}
                        >
                            Upload Picture
                        </button>
                    </div>
                </section>

                {/* Bio */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <FileText className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Bio</h2>
                    </div>
                    <textarea
                        value={profile.bio}
                        onChange={handleBioChange}
                        placeholder="Tell us about yourself..."
                        className="w-full p-4 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-accent transition resize-none"
                        rows={4}
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-textSecondary">{profile.bio.length}/500 characters</span>
                        <button
                            onClick={handleBioSave}
                            disabled={saving}
                            className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save Bio"}
                        </button>
                    </div>
                </section>

                {/* Favorite Movie */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <Film className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Favorite Movie</h2>
                    </div>
                    <button
                        onClick={() => openFavoriteSearch("movie")}
                        className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition"
                    >
                        {profile.favorite_movie_id ? "Change Favorite Movie" : "Select Favorite Movie"}
                    </button>
                    {profile.favorite_movie_id && (
                        <p className="mt-2 text-textSecondary">Movie ID: {profile.favorite_movie_id}</p>
                    )}
                </section>

                {/* Favorite Series */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <Tv className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Favorite Series</h2>
                    </div>
                    <button
                        onClick={() => openFavoriteSearch("tv")}
                        className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition"
                    >
                        {profile.favorite_series_id ? "Change Favorite Series" : "Select Favorite Series"}
                    </button>
                    {profile.favorite_series_id && (
                        <p className="mt-2 text-textSecondary">Series ID: {profile.favorite_series_id}</p>
                    )}
                </section>

                {/* Favorite Episode */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <Play className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Favorite Episode</h2>
                    </div>
                    <button
                        onClick={() => showToast.info("Episode selection coming soon")}
                        className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition"
                    >
                        Select Favorite Episode
                    </button>
                </section>

                {/* Profile Banner */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <Palette className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Profile Banner</h2>
                    </div>
                    <button
                        onClick={() => setBannerModalOpen(true)}
                        className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition"
                    >
                        Change Banner
                    </button>
                    {profile.profile_banner_url && (
                        <div className="mt-4 relative aspect-[3/1] rounded-lg overflow-hidden">
                            <img src={profile.profile_banner_url} alt="Profile Banner" className="w-full h-full object-cover" />
                        </div>
                    )}
                </section>
            </div>

            {/* Search Modal */}
            <SearchModal
                isOpen={searchModalOpen}
                onClose={() => setSearchModalOpen(false)}
                onSelect={handleFavoriteSelect}
                type={searchType}
                title={`Select Favorite ${searchType === "movie" ? "Movie" : "Series"}`}
            />

            {/* Banner Selection Modal */}
            <BannerSelectionModal
                isOpen={bannerModalOpen}
                onClose={() => setBannerModalOpen(false)}
                onSelect={handleBannerSelect}
            />
        </main>
    );
}
