"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
} from "firebase/firestore";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

const AuthContext = createContext({});

// ───────────────────────────────────────────────
// Firebase auth error → human-readable message
// ───────────────────────────────────────────────
const FIREBASE_ERROR_MAP = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/account-exists-with-different-credential":
        "An account already exists with this email using a different sign-in method.",
    "auth/popup-blocked": "Sign-in popup was blocked by your browser. Please allow popups.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/requires-recent-login": "Please sign in again before performing this action.",
    "auth/user-disabled": "This account has been disabled.",
};

function getFirebaseErrorMessage(error) {
    const code = error?.code || "";
    return FIREBASE_ERROR_MAP[code] || error?.message || "An unexpected error occurred.";
}

// ───────────────────────────────────────────────
// Generate a unique username
// ───────────────────────────────────────────────
async function generateUniqueUsername(baseName) {
    const base =
        (baseName || "user")
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "")
            .slice(0, 15) || "user";

    let candidate = base.length >= 3 ? base : `${base}_user`;
    for (let attempt = 0; attempt < 10; attempt++) {
        const q = query(
            collection(db, "user_profiles"),
            where("username_lowercase", "==", candidate)
        );
        const snap = await getDocs(q);
        if (snap.empty) return candidate;
        candidate = `${base}${Math.floor(Math.random() * 9999)}`;
    }
    return `${base}_${Date.now().toString(36)}`;
}

// ───────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Helper: attach profile data to user object
    const attachProfileData = useCallback(async (firebaseUser) => {
        if (!firebaseUser) return null;
        try {
            const snap = await getDoc(doc(db, "user_profiles", firebaseUser.uid));
            if (snap.exists()) {
                const data = snap.data();
                let photo = data.profile_picture_url || firebaseUser.photoURL;
                if (photo && (typeof photo !== "string" || !photo.startsWith("http"))) {
                    photo = null;
                }
                firebaseUser.photoURL = photo;
                firebaseUser.username = data.username || null;
                firebaseUser.username_lowercase = data.username_lowercase || null;
                firebaseUser.needsUsername = !data.username;
            } else {
                firebaseUser.needsUsername = true;
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
        }
        return firebaseUser;
    }, []);

    // ──── auth state listener ────
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                await attachProfileData(u);
                setUser({ ...u });
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [attachProfileData]);

    // ──── Listen for profile updates (avatar, etc.) ────
    useEffect(() => {
        const handleProfileUpdate = (data) => {
            if (!auth.currentUser) return;
            if (data?.type === "avatar" && data?.url) {
                // Immediately update user state with new photo
                setUser(prev => prev ? { ...prev, photoURL: data.url } : prev);
            } else {
                // Refetch profile from Firestore for other updates
                attachProfileData(auth.currentUser).then(u => {
                    if (u) setUser({ ...u });
                });
            }
        };
        eventBus.on("PROFILE_UPDATED", handleProfileUpdate);
        return () => eventBus.off("PROFILE_UPDATED", handleProfileUpdate);
    }, [attachProfileData]);

    // ──── Email Sign Up ────
    const emailSignUp = async (email, password, displayName, username) => {
        // 1. Create auth user — let Firebase throw specific errors (no generic catch)
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // 2. Update display name
        const name = displayName || email.split("@")[0];
        await updateProfile(result.user, { displayName: name });

        // 3. Generate username if not provided
        const finalUsername = username || (await generateUniqueUsername(name));

        // 4. Create Firestore profile ONLY if it doesn't already exist
        const userDocRef = doc(db, "user_profiles", result.user.uid);
        const existing = await getDoc(userDocRef);
        if (!existing.exists()) {
            await setDoc(userDocRef, {
                email,
                displayName: name,
                username: finalUsername,
                username_lowercase: finalUsername.toLowerCase(),
                provider: "email",
                profile_picture_url: null,
                createdAt: serverTimestamp(),
            });
        }

        // 5. Attach data to user object
        result.user.username = finalUsername;
        result.user.username_lowercase = finalUsername.toLowerCase();
        result.user.needsUsername = false;

        return result;
    };

    // ──── Email Login ────
    const emailLogin = async (email, password) => {
        // Let Firebase throw specific errors (no generic catch)
        const result = await signInWithEmailAndPassword(auth, email, password);

        // Fetch profile & backfill username if missing
        const userDocRef = doc(db, "user_profiles", result.user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            const data = snap.data();
            result.user.username = data.username || null;
            if (!data.username) {
                const username = await generateUniqueUsername(
                    data.displayName || email.split("@")[0]
                );
                await setDoc(
                    userDocRef,
                    { username, username_lowercase: username.toLowerCase() },
                    { merge: true }
                );
                result.user.username = username;
                result.user.username_lowercase = username.toLowerCase();
            }
        }
        return result;
    };

    // ──── Google Sign In / Sign Up ────
    const googleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        const result = await signInWithPopup(auth, provider);
        const userDocRef = doc(db, "user_profiles", result.user.uid);
        const snap = await getDoc(userDocRef);

        if (!snap.exists()) {
            // New Google user — create profile
            const autoUsername = await generateUniqueUsername(
                result.user.displayName || result.user.email?.split("@")[0]
            );
            await setDoc(userDocRef, {
                email: result.user.email,
                displayName: result.user.displayName,
                username: autoUsername,
                username_lowercase: autoUsername.toLowerCase(),
                provider: "google",
                profile_picture_url: result.user.photoURL,
                createdAt: serverTimestamp(),
            });
            result.user.username = autoUsername;
            result.user.username_lowercase = autoUsername.toLowerCase();
            result.user.needsUsername = true; // send to onboarding
            result.isNewUser = true;
        } else {
            const data = snap.data();
            result.user.username = data.username || null;
            result.user.needsUsername = !data.username;
            result.isNewUser = false;

            // Backfill username if missing
            if (!data.username) {
                const username = await generateUniqueUsername(
                    data.displayName || result.user.email?.split("@")[0]
                );
                await setDoc(
                    userDocRef,
                    { username, username_lowercase: username.toLowerCase() },
                    { merge: true }
                );
                result.user.username = username;
                result.user.username_lowercase = username.toLowerCase();
                result.user.needsUsername = true;
            }
        }

        return result;
    };

    // ──── Re-authenticate (for sensitive ops like delete) ────
    const reauthenticate = async (password) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not signed in");

        const providers = currentUser.providerData.map((p) => p.providerId);

        if (providers.includes("google.com")) {
            const googleProvider = new GoogleAuthProvider();
            await reauthenticateWithPopup(currentUser, googleProvider);
        } else if (providers.includes("password") && password) {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
        } else {
            throw new Error("Unable to re-authenticate. Please sign in again.");
        }
    };

    // ──── Delete Account (hard cascade delete) ────
    const deleteAccount = async (password) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not signed in");

        // 1. Re-authenticate first
        await reauthenticate(password);

        const uid = currentUser.uid;

        // 2. Delete all Firestore user data
        const collectionsToClean = [
            { name: "user_watched", field: "userId" },
            { name: "user_watchlist", field: "userId" },
            { name: "user_paused", field: "userId" },
            { name: "user_dropped", field: "userId" },
            { name: "user_ratings", field: "userId" },
            { name: "favorites_movies", field: "userId" },
            { name: "favorites_shows", field: "userId" },
            { name: "user_media_preferences", field: "userId" },
        ];

        for (const col of collectionsToClean) {
            try {
                const q = query(collection(db, col.name), where(col.field, "==", uid));
                const snapshot = await getDocs(q);
                if (snapshot.empty) continue;

                // Process in batches of 450 (Firestore limit is 500)
                const docs = snapshot.docs;
                for (let i = 0; i < docs.length; i += 450) {
                    const batch = writeBatch(db);
                    const chunk = docs.slice(i, i + 450);
                    chunk.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                }
            } catch (e) {
                console.error(`Error cleaning ${col.name}:`, e);
            }
        }

        // 3. Delete user profile doc
        try {
            await deleteDoc(doc(db, "user_profiles", uid));
        } catch (e) {
            console.error("Error deleting user profile:", e);
        }

        // 4. Delete Firebase Auth user
        await deleteUser(currentUser);

        // 5. Clear local state
        setUser(null);
    };

    // ──── Logout ────
    const logout = () => signOut(auth);

    const resetPassword = async (email) => {
        await sendPasswordResetEmail(auth, email);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                emailSignUp,
                emailLogin,
                googleSignIn,
                // Aliases so login/signup pages work with either name
                signUp: emailSignUp,
                signIn: emailLogin,
                signInWithGoogle: googleSignIn,
                reauthenticate,
                deleteAccount,
                logout,
                resetPassword,
                getFirebaseErrorMessage,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
