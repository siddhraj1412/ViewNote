"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, writeBatch } from "firebase/firestore";
import { User, FileText, Film, Tv, Play, Palette, Trash2, AlertTriangle, Camera, LogOut, Image as ImageIcon, ChevronRight, Pencil, Download } from "lucide-react";
import LetterboxdImportSection from "@/components/settings/LetterboxdImportSection";
import showToast from "@/lib/toast";
import FavoritesEditDialog from "@/components/settings/FavoritesEditDialog";
import FavoriteEpisodesDialog from "@/components/settings/FavoriteEpisodesDialog";
import BannerSelectionModal from "@/components/settings/BannerSelectionModal";
import DeleteAccountModal from "@/components/settings/DeleteAccountModal";
import AvatarUploadModal from "@/components/AvatarUploadModal";
import eventBus from "@/lib/eventBus";

export default function SettingsPage() {
    const { user, loading: authLoading, logout, deleteAccount, getFirebaseErrorMessage } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState({
        profile_picture_url: "",
        bio: "",
        profile_banner_url: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bannerModalOpen, setBannerModalOpen] = useState(false);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);

    // Favorites state
    const [favMovies, setFavMovies] = useState([]);
    const [favShows, setFavShows] = useState([]);
    const [favEpisodes, setFavEpisodes] = useState([]);
    const [favMoviesDialogOpen, setFavMoviesDialogOpen] = useState(false);
    const [favShowsDialogOpen, setFavShowsDialogOpen] = useState(false);
    const [favEpisodesDialogOpen, setFavEpisodesDialogOpen] = useState(false);

    // Delete account state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

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
            const [moviesSnap, showsSnap, episodesSnap] = await Promise.all([
                getDocs(query(collection(db, "favorites_movies"), where("userId", "==", user.uid))),
                getDocs(query(collection(db, "favorites_shows"), where("userId", "==", user.uid))),
                getDocs(query(collection(db, "favorites_episodes"), where("userId", "==", user.uid))),
            ]);

            const moviesData = moviesSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const showsData = showsSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const episodesData = episodesSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            setFavMovies(moviesData);
            setFavShows(showsData);
            setFavEpisodes(episodesData);
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
        const collectionName = type === "movie" ? "favorites_movies" : type === "episode" ? "favorites_episodes" : "favorites_shows";

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
                    poster_path: item.poster_path || null,
                    ...(item.release_date ? { release_date: item.release_date } : {}),
                    ...(item.air_date ? { air_date: item.air_date } : {}),
                    ...(type === "episode" ? {
                        seriesId: item.seriesId || null,
                        seasonNumber: item.seasonNumber || null,
                        episodeNumber: item.episodeNumber || null,
                        episodeName: item.episodeName || null,
                        series_name: item.series_name || null,
                        still_path: item.still_path || null,
                    } : {}),
                    order: index,
                    createdAt: new Date().toISOString(),
                });
            });

            await batch.commit();

            // Update local state
            if (type === "movie") {
                setFavMovies(items.map((item, i) => ({ ...item, order: i, id: `${user.uid}_${item.mediaId}` })));
            } else if (type === "episode") {
                setFavEpisodes(items.map((item, i) => ({ ...item, order: i, id: `${user.uid}_${item.mediaId}` })));
            } else {
                setFavShows(items.map((item, i) => ({ ...item, order: i, id: `${user.uid}_${item.mediaId}` })));
            }

            // Emit event for profile to re-render
            eventBus.emit("FAVORITES_UPDATED", { type });

            const label = type === "movie" ? "movies" : type === "episode" ? "episodes" : "series";
            showToast.success(`Favorite ${label} saved`);
        } catch (error) {
            console.error("Error saving favorites:", error);
            showToast.error("Failed to save favorites");
        }
    }, [user]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    const handleDeleteAccount = async (password) => {
        try {
            await deleteAccount(password);
            showToast.success("Account deleted successfully.");
            router.replace("/login");
        } catch (err) {
            throw err; // Let the modal display the error
        }
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
            <div className="site-container py-10 max-w-3xl mx-auto px-4">
                {/* Page Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-textSecondary text-sm mt-1">Manage your profile, favorites, and account</p>
                </div>

                {/* ─── Profile Section ─── */}
                <section className="mb-10">
                    <SectionLabel icon={User} title="Profile" />

                    {/* Avatar + Bio card */}
                    <div className="bg-secondary rounded-2xl overflow-hidden">
                        {/* Banner preview (if set) */}
                        {profile.profile_banner_url && (
                            <div className="relative h-28 w-full">
                                <img src={profile.profile_banner_url} alt="Banner" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 to-transparent" />
                            </div>
                        )}

                        <div className={`p-6 ${profile.profile_banner_url ? "-mt-10 relative z-10" : ""}`}>
                            {/* Avatar row */}
                            <div className="flex items-center gap-5 mb-6">
                                <button
                                    onClick={() => setAvatarModalOpen(true)}
                                    className="relative group flex-shrink-0"
                                >
                                    <div className="w-20 h-20 rounded-full bg-background border-2 border-white/10 flex items-center justify-center text-3xl font-bold overflow-hidden
                                                    group-hover:border-accent transition-colors">
                                        {profile.profile_picture_url ? (
                                            <img
                                                src={profile.profile_picture_url}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; e.target.parentElement.textContent = (user.username?.[0] || "U").toUpperCase(); }}
                                            />
                                        ) : (
                                            (user.username?.[0] || user.email?.[0] || "U").toUpperCase()
                                        )}
                                    </div>
                                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera size={18} className="text-white" />
                                    </div>
                                </button>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold truncate">{user.username || user.email}</h2>
                                    <p className="text-xs text-textSecondary mt-0.5">{user.email}</p>
                                </div>
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="text-xs font-medium text-textSecondary uppercase tracking-wider mb-2 block">Bio</label>
                                <textarea
                                    value={profile.bio || ""}
                                    onChange={handleBioChange}
                                    placeholder="Tell us about yourself..."
                                    className="w-full p-3 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition resize-none"
                                    rows={3}
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-textSecondary">{(profile.bio || "").length}/500</span>
                                    <button
                                        onClick={handleBioSave}
                                        disabled={saving}
                                        className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/85 transition disabled:opacity-50"
                                    >
                                        {saving ? "Saving…" : "Save Bio"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Banner picker row */}
                    <button
                        onClick={() => setBannerModalOpen(true)}
                        className="mt-3 w-full flex items-center justify-between p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition group"
                    >
                        <div className="flex items-center gap-3">
                            <ImageIcon size={18} className="text-accent" />
                            <span className="text-sm font-medium">Profile Banner</span>
                        </div>
                        <ChevronRight size={16} className="text-textSecondary group-hover:text-accent transition-colors" />
                    </button>
                </section>

                {/* ─── Favorites Section ─── */}
                <section className="mb-10">
                    <SectionLabel icon={Film} title="Favorites" />

                    {/* Favorite Movies */}
                    <FavoritesCard
                        icon={Film}
                        label="Movies"
                        items={favMovies}
                        onEdit={() => setFavMoviesDialogOpen(true)}
                        previewType="poster"
                    />

                    {/* Favorite Series */}
                    <FavoritesCard
                        icon={Tv}
                        label="Series"
                        items={favShows}
                        onEdit={() => setFavShowsDialogOpen(true)}
                        previewType="poster"
                        className="mt-3"
                    />

                    {/* Favorite Episodes */}
                    <FavoritesCard
                        icon={Play}
                        label="Episodes"
                        items={favEpisodes}
                        onEdit={() => setFavEpisodesDialogOpen(true)}
                        previewType="landscape"
                        className="mt-3"
                    />
                </section>

                {/* ─── Import Section ─── */}
                <section className="mb-10">
                    <SectionLabel icon={Download} title="Import Data" />
                    <div className="bg-secondary rounded-2xl p-5">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-white">Import from Letterboxd</h3>
                            <p className="text-xs text-textSecondary mt-1">Upload your Letterboxd ZIP export to import watched history, ratings, reviews, likes, watchlist, and lists.</p>
                        </div>
                        <LetterboxdImportSection />
                    </div>
                </section>

                {/* ─── Account Section ─── */}
                <section className="mb-10">
                    <SectionLabel icon={User} title="Account" />

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition group"
                    >
                        <LogOut size={18} className="text-textSecondary group-hover:text-accent" />
                        <span className="text-sm font-medium">Log Out</span>
                    </button>

                    {/* Danger Zone */}
                    <div className="mt-3 p-4 bg-secondary rounded-xl border border-red-500/10">
                        <div className="flex items-center gap-3 mb-2">
                            <AlertTriangle size={16} className="text-red-400" />
                            <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
                        </div>
                        <p className="text-xs text-textSecondary mb-3 ml-7">
                            Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <button
                            onClick={() => setDeleteModalOpen(true)}
                            className="ml-7 px-4 py-1.5 text-xs font-medium bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            Delete Account
                        </button>
                    </div>
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

            <FavoriteEpisodesDialog
                isOpen={favEpisodesDialogOpen}
                onClose={() => setFavEpisodesDialogOpen(false)}
                onSave={(items) => saveFavorites("episode", items)}
                currentFavorites={favEpisodes}
            />

            {/* Banner Selection Modal */}
            <BannerSelectionModal
                isOpen={bannerModalOpen}
                onClose={() => setBannerModalOpen(false)}
                onSelect={handleBannerSelect}
            />

            {/* Delete Account Modal */}
            <DeleteAccountModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                username={user?.username || user?.email || ""}
                isGoogleUser={user?.providerData?.some((p) => p.providerId === "google.com") || false}
            />

            {/* Avatar Upload Modal */}
            <AvatarUploadModal
                isOpen={avatarModalOpen}
                onClose={() => setAvatarModalOpen(false)}
                userId={user.uid}
                currentAvatar={profile.profile_picture_url}
                onUploadSuccess={(url) => {
                    setProfile(prev => ({ ...prev, profile_picture_url: url }));
                    eventBus.emit("PROFILE_UPDATED", { type: "avatar", url });
                }}
            />
        </main>
    );
}

// Section label with icon
function SectionLabel({ icon: Icon, title }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon size={14} className="text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-textSecondary">{title}</h2>
        </div>
    );
}

// Collapsible favorites card
function FavoritesCard({ icon: Icon, label, items, onEdit, previewType, className = "" }) {
    const hasItems = items && items.length > 0;

    return (
        <div className={`bg-secondary rounded-xl overflow-hidden ${className}`}>
            <button
                onClick={onEdit}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition group"
            >
                <div className="flex items-center gap-3">
                    <Icon size={18} className="text-accent" />
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-textSecondary bg-background/50 px-2 py-0.5 rounded-full">
                        {items.length}/5
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Pencil size={14} className="text-textSecondary group-hover:text-accent transition-colors" />
                </div>
            </button>

            {hasItems && (
                <div className="px-4 pb-4">
                    {previewType === "landscape" ? (
                        <div className="grid grid-cols-5 gap-2">
                            {items.slice(0, 5).map((item) => (
                                <div key={item.id} className="group/card">
                                    <div className="relative aspect-video rounded-lg overflow-hidden bg-background">
                                        {(item.still_path || item.poster_path) ? (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w300${item.still_path || item.poster_path}`}
                                                alt={item.title || "Episode"}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/15">
                                                <Play size={16} />
                                            </div>
                                        )}
                                    </div>
                                    <p className="mt-1 text-[11px] text-textSecondary line-clamp-1">{item.episodeName || item.title}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-5 gap-2">
                            {items.slice(0, 5).map((item) => (
                                <div key={item.id} className="group/card">
                                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-background">
                                        {item.poster_path ? (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                                                alt={item.title || "Poster"}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/15">
                                                <Film size={16} />
                                            </div>
                                        )}
                                    </div>
                                    <p className="mt-1 text-[11px] text-textSecondary line-clamp-1">{item.title}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
