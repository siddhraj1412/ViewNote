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
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import showToast from "@/lib/toast";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                // Fetch extra profile data (like avatar) from Firestore if needed
                // For now, we rely on auth object, but we might want to listen to firestore profile
                try {
                    const userDoc = await getDoc(doc(db, "user_profiles", u.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        // Merge firestore data into user object for easy access
                        let photo = userData.profile_picture_url || u.photoURL;

                        // Basic validation: must be a string and start with http/https
                        if (photo && (typeof photo !== 'string' || !photo.startsWith('http'))) {
                            photo = null;
                        }

                        u.photoURL = photo;
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
            // Check if new user
            const userDoc = await getDoc(doc(db, "user_profiles", result.user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "user_profiles", result.user.uid), {
                    email: result.user.email,
                    displayName: result.user.displayName,
                    profile_picture_url: result.user.photoURL,
                    createdAt: serverTimestamp(),
                });
            }
        } catch (error) {
            showToast.error(error.message);
        }
    };

    const emailSignUp = async (email, password, displayName) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(result.user, { displayName });
            await setDoc(doc(db, "user_profiles", result.user.uid), {
                email,
                displayName,
                profile_picture_url: null,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            showToast.error(error.message);
            throw error;
        }
    };

    const emailLogin = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
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
