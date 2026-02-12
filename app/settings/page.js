"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, writeBatch } from "firebase/firestore";
import { User, FileText, Film, Tv, Play, Palette } from "lucide-react";
import showToast from "@/lib/toast";
import FavoritesEditDialog from "@/components/settings/FavoritesEditDialog";
import BannerSelectionModal from "@/components/settings/BannerSelectionModal";
import eventBus from "@/lib/eventBus";

export default function SettingsPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState({
        profile_picture_url: "",
        bio: "",
        profile_banner_url: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bannerModalOpen, setBannerModalOpen] = useState(false);

    // Favorites state
    const [favMovies, setFavMovies] = useState([]);
    const [favShows, setFavShows] = useState([]);
    const [favMoviesDialogOpen, setFavMoviesDialogOpen] = useState(false);
    const [favShowsDialogOpen, setFavShowsDialogOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            loadProfile();
            loadFavorites();
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

    const loadFavorites = async () => {
        try {
            const [moviesSnap, showsSnap] = await Promise.all([
                getDocs(query(collection(db, "favorites_movies"), where("userId", "==", user.uid))),
                getDocs(query(collection(db, "favorites_shows"), where("userId", "==", user.uid))),
            ]);

            const moviesData = moviesSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const showsData = showsSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            setFavMovies(moviesData);
            setFavShows(showsData);
        } catch (error) {
            console.error("Error loading favorites:", error);
        }
    };

    const saveProfile = async (updates) => {
        setSaving(true);
        try {
            const profileRef = doc(db, "user_profiles", user.uid);
            await setDoc(profileRef, { ...profile, ...updates, userId: user.uid }, { merge: true });

            setProfile((prev) => ({ ...prev, ...updates }));

            eventBus.emit("PROFILE_UPDATED", { type: "settings", updates });
            showToast.success("Profile updated");
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

    const handleBannerSelect = (bannerUrl) => {
        saveProfile({ profile_banner_url: bannerUrl });
    };

    // Save favorites to Firebase
    const saveFavorites = useCallback(async (type, items) => {
        const collectionName = type === "movie" ? "favorites_movies" : "favorites_shows";

        try {
            // Delete all existing
            const existingSnap = await getDocs(
                query(collection(db, collectionName), where("userId", "==", user.uid))
            );

            const batch = writeBatch(db);
            existingSnap.docs.forEach((d) => {
                batch.delete(d.ref);
            });

            // Add new ones with order
            items.forEach((item, index) => {
                const docRef = doc(db, collectionName, `${user.uid}_${item.mediaId}`);
                batch.set(docRef, {
                    userId: user.uid,
                    mediaId: item.mediaId,
                    mediaType: item.mediaType || type,
                    title: item.title,
                    poster_path: item.poster_path,
                    release_date: item.release_date,
                    order: index,
                    createdAt: new Date().toISOString(),
                });
            });

            await batch.commit();

            // Update local state
            if (type === "movie") {
                setFavMovies(items.map((item, i) => ({ ...item, order: i, id: `${user.uid}_${item.mediaId}` })));
            } else {
                setFavShows(items.map((item, i) => ({ ...item, order: i, id: `${user.uid}_${item.mediaId}` })));
            }

            // Emit event for profile to re-render
            eventBus.emit("FAVORITES_UPDATED", { type });

            showToast.success(`Favorite ${type === "movie" ? "movies" : "series"} saved`);
        } catch (error) {
            console.error("Error saving favorites:", error);
            showToast.error("Failed to save favorites");
        }
    }, [user]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
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
                        value={profile.bio || ""}
                        onChange={handleBioChange}
                        placeholder="Tell us about yourself..."
                        className="w-full p-4 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-accent transition resize-none"
                        rows={4}
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-textSecondary">{(profile.bio || "").length}/500 characters</span>
                        <button
                            onClick={handleBioSave}
                            disabled={saving}
                            className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save Bio"}
                        </button>
                    </div>
                </section>

                {/* Favorite Movies — 5-slot editor */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Film className="text-accent" size={24} />
                            <h2 className="text-2xl font-bold">Favorite Movies</h2>
                        </div>
                        <button
                            onClick={() => setFavMoviesDialogOpen(true)}
                            className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition text-sm font-medium"
                        >
                            Edit Favorites
                        </button>
                    </div>
                    {/* Preview of current favorites */}
                    <FavoritesPreview items={favMovies} type="movie" />
                </section>

                {/* Favorite Series — 5-slot editor */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Tv className="text-accent" size={24} />
                            <h2 className="text-2xl font-bold">Favorite Series</h2>
                        </div>
                        <button
                            onClick={() => setFavShowsDialogOpen(true)}
                            className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition text-sm font-medium"
                        >
                            Edit Favorites
                        </button>
                    </div>
                    <FavoritesPreview items={favShows} type="tv" />
                </section>

                {/* Favorite Episodes — Coming Soon */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <Play className="text-accent" size={24} />
                        <h2 className="text-2xl font-bold">Favorite Episodes</h2>
                    </div>
                    <p className="text-textSecondary text-sm">Episode selection coming soon.</p>
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

                {/* Logout */}
                <section className="mb-8 p-6 bg-secondary rounded-xl">
                    <button
                        onClick={handleLogout}
                        className="px-6 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition font-medium"
                    >
                        Logout
                    </button>
                </section>
            </div>

            {/* Favorites Edit Dialogs */}
            <FavoritesEditDialog
                isOpen={favMoviesDialogOpen}
                onClose={() => setFavMoviesDialogOpen(false)}
                onSave={(items) => saveFavorites("movie", items)}
                type="movie"
                currentFavorites={favMovies}
            />

            <FavoritesEditDialog
                isOpen={favShowsDialogOpen}
                onClose={() => setFavShowsDialogOpen(false)}
                onSave={(items) => saveFavorites("tv", items)}
                type="tv"
                currentFavorites={favShows}
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

// Inline preview component for settings
function FavoritesPreview({ items, type }) {

    if (items.length === 0) {
        return <p className="text-sm text-textSecondary">No favorites set. Click "Edit Favorites" to add up to 5.</p>;
    }

    return (
        <div className="grid grid-cols-5 gap-3">
            {items.slice(0, 5).map((item) => (
                <div key={item.id} className="text-center">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-background">
                        {item.poster_path ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                                alt={item.title || "Poster"}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                <Film size={18} />
                            </div>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-textSecondary line-clamp-1">{item.title}</p>
                </div>
            ))}
        </div>
    );
}
