"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import supabase from "@/lib/supabase";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

const AuthContext = createContext({});

// ───────────────────────────────────────────────
// Supabase auth error → human-readable message
// ───────────────────────────────────────────────
const ERROR_MAP = {
    "User already registered": "An account with this email already exists.",
    "Invalid login credentials": "Invalid email or password.",
    "Email not confirmed": "Please verify your email before signing in.",
    "Signup requires a valid password": "Password must be at least 6 characters.",
    "Password should be at least 6 characters": "Password must be at least 6 characters.",
    "Unable to validate email address: invalid format": "Please enter a valid email address.",
    "Email rate limit exceeded": "Too many attempts. Please wait a moment and try again.",
    "For security purposes, you can only request this once every 60 seconds": "Please wait 60 seconds before trying again.",
    "New password should be different from the old password": "New password must be different from your current password.",
};

function getAuthErrorMessage(error) {
    if (!error) return "An unexpected error occurred.";
    const msg = error?.message || error?.error_description || "";
    for (const [key, value] of Object.entries(ERROR_MAP)) {
        if (msg.includes(key)) return value;
    }
    return msg || "An unexpected error occurred.";
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
        const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("username_lowercase", candidate)
            .limit(1);
        if (!data || data.length === 0) return candidate;
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
    const attachProfileData = useCallback(async (supabaseUser) => {
        if (!supabaseUser) return null;
        try {
            let { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", supabaseUser.id)
                .single();

            // If profile doesn't exist (trigger may have failed), create it now
            if (!profile) {
                const fallbackName =
                    supabaseUser.user_metadata?.display_name ||
                    supabaseUser.user_metadata?.full_name ||
                    supabaseUser.email?.split("@")[0] ||
                    "user";
                const { data: created } = await supabase
                    .from("profiles")
                    .upsert(
                        {
                            id: supabaseUser.id,
                            email: supabaseUser.email,
                            displayName: fallbackName,
                            provider: supabaseUser.app_metadata?.provider || "email",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                        { onConflict: "id" }
                    )
                    .select("*")
                    .single();
                profile = created;
            }

            // Build a user-like object compatible with the rest of the app
            const enriched = {
                uid: supabaseUser.id,
                email: supabaseUser.email,
                displayName: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split("@")[0],
                emailVerified: supabaseUser.email_confirmed_at != null,
                providerData: [{ providerId: supabaseUser.app_metadata?.provider || "email" }],
            };

            if (profile) {
                let photo = profile.profile_picture_url || supabaseUser.user_metadata?.avatar_url;
                if (photo && (typeof photo !== "string" || !photo.startsWith("http"))) {
                    photo = null;
                }
                enriched.photoURL = photo;
                enriched.username = profile.username || null;
                enriched.username_lowercase = profile.username_lowercase || null;
                enriched.onboardingComplete = profile.onboardingComplete === true;
                enriched.needsUsername = !profile.username || profile.onboardingComplete === false;
                // Auto-backfill onboardingComplete for existing users with username
                if (profile.username && profile.onboardingComplete === undefined) {
                    supabase
                        .from("profiles")
                        .update({ onboardingComplete: true })
                        .eq("id", supabaseUser.id)
                        .then(() => {});
                    enriched.onboardingComplete = true;
                    enriched.needsUsername = false;
                }
            } else {
                enriched.photoURL = supabaseUser.user_metadata?.avatar_url || null;
                enriched.needsUsername = true;
                enriched.onboardingComplete = false;
            }

            return enriched;
        } catch (e) {
            console.error("Error fetching user profile:", e);
            return {
                uid: supabaseUser.id,
                email: supabaseUser.email,
                displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split("@")[0],
                photoURL: supabaseUser.user_metadata?.avatar_url || null,
                needsUsername: true,
                onboardingComplete: false,
                providerData: [{ providerId: supabaseUser.app_metadata?.provider || "email" }],
            };
        }
    }, []);

    // ──── auth state listener ────
    useEffect(() => {
        let initialSessionHandled = false;

        // Get initial session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const enriched = await attachProfileData(session.user);
                setUser(enriched);
            } else {
                setUser(null);
            }
            initialSessionHandled = true;
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Skip INITIAL_SESSION — we handle it via getSession() above
            if (event === "INITIAL_SESSION") return;

            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
                if (session?.user) {
                    const enriched = await attachProfileData(session.user);
                    setUser(enriched);
                }
            } else if (event === "SIGNED_OUT") {
                setUser(null);
            }
            if (initialSessionHandled) {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [attachProfileData]);

    // ──── Listen for profile updates (avatar, etc.) ────
    useEffect(() => {
        const handleProfileUpdate = async (data) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            if (data?.type === "avatar" && data?.url) {
                setUser(prev => prev ? { ...prev, photoURL: data.url } : prev);
            } else {
                const enriched = await attachProfileData(session.user);
                if (enriched) setUser(enriched);
            }
        };
        eventBus.on("PROFILE_UPDATED", handleProfileUpdate);
        return () => eventBus.off("PROFILE_UPDATED", handleProfileUpdate);
    }, [attachProfileData]);

    // ──── Email Sign Up ────
    const emailSignUp = async (email, password, displayName, username) => {
        const name = displayName || email.split("@")[0];
        const finalUsername = username || (await generateUniqueUsername(name));

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: name },
                // Skip email confirmation — auto-confirm the user
                emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            },
        });

        if (error) throw error;
        if (!data.user) throw new Error("Signup failed — no user returned.");

        // If Supabase requires email confirmation and no session is returned,
        // the user's email_confirmed_at will be null. Try to sign them in directly.
        if (!data.session) {
            try {
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                // If auto-login fails (email not confirmed), that's OK — continue with profile creation
                if (loginError) {
                    console.warn("Auto-login after signup failed (email confirmation may be required):", loginError.message);
                }
            } catch {
                // Ignore — profile creation below is still important
            }
        }

        // Create profile (trigger may also create one, use upsert)
        const { error: profileError } = await supabase.from("profiles").upsert({
            id: data.user.id,
            email,
            displayName: name,
            username: finalUsername,
            username_lowercase: finalUsername.toLowerCase(),
            provider: "email",
            profile_picture_url: null,
            onboardingComplete: true,
            createdAt: new Date().toISOString(),
        }, { onConflict: "id" });
        if (profileError) {
            console.error("Profile creation failed:", profileError);
            // Auth user exists but profile failed — don't leave user in a broken state
            throw new Error("Account created but profile setup failed. Please try logging in.");
        }

        // Build result compatible with the rest of the app
        const result = { user: data.user };
        result.user.uid = data.user.id;
        result.user.username = finalUsername;
        result.user.username_lowercase = finalUsername.toLowerCase();
        result.user.needsUsername = false;
        result.user.displayName = name;

        return result;
    };

    // ──── Email Login ────
    const emailLogin = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const result = { user: data.user };
        result.user.uid = data.user.id;

        // Fetch profile & backfill username if missing
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

        if (profile) {
            result.user.username = profile.username || null;
            result.user.displayName = profile.displayName || email.split("@")[0];
            if (!profile.username) {
                const newUsername = await generateUniqueUsername(
                    profile.displayName || email.split("@")[0]
                );
                await supabase
                    .from("profiles")
                    .update({ username: newUsername, username_lowercase: newUsername.toLowerCase() })
                    .eq("id", data.user.id);
                result.user.username = newUsername;
                result.user.username_lowercase = newUsername.toLowerCase();
            }
        }
        return result;
    };

    // ──── Google Sign In / Sign Up ────
    const googleSignIn = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: { prompt: "select_account" },
            },
        });

        if (error) throw error;

        // OAuth redirects the browser — profile creation happens in onAuthStateChange
        // after the redirect returns via /auth/callback.
        // Return data for compatibility.
        return data;
    };

    // ──── Re-authenticate (for sensitive ops like delete) ────
    const reauthenticate = async (password) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not signed in");

        const provider = session.user.app_metadata?.provider;

        if (provider === "google") {
            // For Google users, just verify the session is fresh
            const { error } = await supabase.auth.refreshSession();
            if (error) throw new Error("Unable to re-authenticate. Please sign in again.");
        } else if (password) {
            // Re-login with password to verify identity
            const { error } = await supabase.auth.signInWithPassword({
                email: session.user.email,
                password,
            });
            if (error) throw error;
        } else {
            throw new Error("Unable to re-authenticate. Please sign in again.");
        }
    };

    // ──── Delete Account (hard cascade delete) ────
    const deleteAccount = async (password) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not signed in");

        // 1. Re-authenticate first
        await reauthenticate(password);

        const uid = session.user.id;

        // 2. Delete all user data via RPC (cascade)
        const { error: rpcError } = await supabase.rpc("delete_user_data", { p_user_id: uid });
        if (rpcError) {
            console.error("Error deleting user data:", rpcError);
            // If the RPC doesn't exist, delete what we can manually
            if (rpcError.message?.includes("function") || rpcError.code === "42883") {
                // Delete data from known tables manually
                const tables = ["user_ratings", "user_reviews", "user_watched", "user_watchlist", "user_lists", "favorites", "user_series_progress", "user_imports", "followers"];
                for (const table of tables) {
                    try { await supabase.from(table).delete().eq("userId", uid); } catch {}
                }
                try { await supabase.from("profiles").delete().eq("id", uid); } catch {}
            } else {
                throw new Error("Failed to delete account data. Please try again.");
            }
        }

        // 3. Sign out
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn("signOut after delete error (ignored):", err);
        }

        // 4. Clear local state
        setUser(null);
    };

    // ──── Change Email ────
    const changeEmail = async (newEmail, password) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not signed in");
        await reauthenticate(password);
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
        // Update profile with pending email
        await supabase
            .from("profiles")
            .update({ pendingEmail: newEmail })
            .eq("id", session.user.id);
    };

    // ──── Change Password ────
    const changePassword = async (currentPassword, newPassword) => {
        await reauthenticate(currentPassword);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
    };

    // ──── Resend Verification Email ────
    const resendVerificationEmail = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not signed in");
        const { error } = await supabase.auth.resend({
            type: "signup",
            email: session.user.email,
        });
        if (error) throw error;
    };

    // ──── Logout ────
    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn("signOut error (ignored):", err);
        }
        setUser(null);
    };

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/settings`,
        });
        if (error) throw error;
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
                changeEmail,
                changePassword,
                resendVerificationEmail,
                logout,
                resetPassword,
                getAuthErrorMessage,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
