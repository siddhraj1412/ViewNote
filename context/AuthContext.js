"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import showToast from "@/lib/toast";

const AuthContext = createContext({});

/**
 * Generate a unique username from display name or email.
 * Appends random digits if the base is taken.
 */
async function generateUniqueUsername(baseName) {
    const base = (baseName || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 15) || 'user';

    // Try base first
    let candidate = base;
    for (let attempt = 0; attempt < 10; attempt++) {
        const q = query(
            collection(db, "user_profiles"),
            where("username_lowercase", "==", candidate)
        );
        const snap = await getDocs(q);
        if (snap.empty) return candidate;
        candidate = `${base}${Math.floor(Math.random() * 9999)}`;
    }
    // Fallback with timestamp
    return `${base}_${Date.now().toString(36)}`;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                try {
                    const userDocRef = doc(db, "user_profiles", u.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        // Merge firestore data into user object for easy access
                        let photo = userData.profile_picture_url || u.photoURL;

                        // Basic validation: must be a string and start with http/https
                        if (photo && (typeof photo !== 'string' || !photo.startsWith('http'))) {
                            photo = null;
                        }

                        u.photoURL = photo;
                        // Attach username to user object for URL generation
                        u.username = userData.username || null;
                        u.username_lowercase = userData.username_lowercase || null;
                    }
                } catch (e) {
                    console.error("Error fetching user profile:", e);
                }
                setUser(u);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const googleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const userDocRef = doc(db, "user_profiles", result.user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                // Generate username for new Google sign-in users
                const username = await generateUniqueUsername(
                    result.user.displayName || result.user.email?.split('@')[0]
                );
                await setDoc(userDocRef, {
                    email: result.user.email,
                    displayName: result.user.displayName,
                    username: username,
                    username_lowercase: username.toLowerCase(),
                    profile_picture_url: result.user.photoURL,
                    createdAt: serverTimestamp(),
                });
                // Attach username to user
                result.user.username = username;
                result.user.username_lowercase = username.toLowerCase();
            } else {
                const data = userDocSnap.data();
                result.user.username = data.username || null;
                // Backfill username for existing users without one
                if (!data.username) {
                    const username = await generateUniqueUsername(
                        data.displayName || result.user.email?.split('@')[0]
                    );
                    await setDoc(userDocRef, {
                        username: username,
                        username_lowercase: username.toLowerCase(),
                    }, { merge: true });
                    result.user.username = username;
                    result.user.username_lowercase = username.toLowerCase();
                }
            }
            return result;
        } catch (error) {
            showToast.error(error.message);
            throw error;
        }
    };

    const emailSignUp = async (email, password, displayName, username) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(result.user, { displayName: displayName || email.split('@')[0] });

            // If no username provided, generate one
            const finalUsername = username || await generateUniqueUsername(displayName || email.split('@')[0]);

            await setDoc(doc(db, "user_profiles", result.user.uid), {
                email,
                displayName: displayName || email.split('@')[0],
                username: finalUsername,
                username_lowercase: finalUsername.toLowerCase(),
                profile_picture_url: null,
                createdAt: serverTimestamp(),
            });

            // Attach username to user
            result.user.username = finalUsername;
            result.user.username_lowercase = finalUsername.toLowerCase();

            return result;
        } catch (error) {
            showToast.error(error.message);
            throw error;
        }
    };

    const emailLogin = async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password);
        // Fetch and attach username
        try {
            const userDocRef = doc(db, "user_profiles", result.user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                result.user.username = data.username || null;
                // Backfill username for existing users without one
                if (!data.username) {
                    const username = await generateUniqueUsername(
                        data.displayName || email.split('@')[0]
                    );
                    await setDoc(userDocRef, {
                        username: username,
                        username_lowercase: username.toLowerCase(),
                    }, { merge: true });
                    result.user.username = username;
                    result.user.username_lowercase = username.toLowerCase();
                }
            }
        } catch (e) {
            console.error("Error fetching user profile on login:", e);
        }
        return result;
    };

    const logout = () => {
        return signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, googleSignIn, emailSignUp, emailLogin, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
