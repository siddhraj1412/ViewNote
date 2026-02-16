"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Check, X, Loader2, AtSign } from "lucide-react";
import { validateUsername } from "@/lib/slugify";

export default function UsernameOnboardingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [status, setStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'
    const [errorMsg, setErrorMsg] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [saving, setSaving] = useState(false);
    const timerRef = useRef(null);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/login");
        }
    }, [user, authLoading, router]);

    // Pre-fill with current auto-generated username
    useEffect(() => {
        if (user?.username && !username) {
            setUsername(user.username);
        }
    }, [user]);

    // Debounced availability check
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);

        if (!username.trim()) {
            setStatus(null);
            setErrorMsg("");
            setSuggestions([]);
            return;
        }

        const validation = validateUsername(username.trim());
        if (!validation.valid) {
            setStatus("invalid");
            setErrorMsg(validation.error);
            setSuggestions([]);
            return;
        }

        setStatus("checking");
        setErrorMsg("");
        timerRef.current = setTimeout(async () => {
            try {
                const res = await fetch("/api/auth/check-username", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: username.trim() }),
                });
                const data = await res.json();

                if (data.available) {
                    setStatus("available");
                    setErrorMsg("");
                    setSuggestions([]);
                } else {
                    // If the taken username is the user's own current username, it's fine
                    if (
                        user?.username &&
                        username.trim().toLowerCase() === user.username.toLowerCase()
                    ) {
                        setStatus("available");
                        setErrorMsg("");
                        setSuggestions([]);
                    } else {
                        setStatus("taken");
                        setErrorMsg(data.error || "Username is taken");
                        setSuggestions(data.suggestions || []);
                    }
                }
            } catch {
                setStatus(null);
                setErrorMsg("Could not verify username");
            }
        }, 400);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };

    }, [username, user]);

    const handleSave = async () => {
        if (status !== "available" || !user) return;

        setSaving(true);
        try {
            const trimmed = username.trim();
            const profileRef = doc(db, "user_profiles", user.uid);
            await setDoc(
                profileRef,
                {
                    username: trimmed,
                    username_lowercase: trimmed.toLowerCase(),
                },
                { merge: true }
            );
            // Navigate to the new profile
            router.replace(`/${trimmed}`);
        } catch (error) {
            console.error("Error saving username:", error);
            setErrorMsg("Failed to save username. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-accent" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <main className="min-h-screen bg-background flex items-center justify-center pt-24 px-4">
            <div className="w-full max-w-md mx-auto">
                <div className="bg-secondary rounded-3xl border border-white/5 p-6 md:p-8 shadow-2xl">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AtSign size={32} className="text-accent" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black">Choose your username</h1>
                            <p className="text-textSecondary mt-2">
                                This will be your unique profile URL.
                                <br />
                                <span className="text-accent font-medium">
                                    viewnote.app/{username || "your-username"}
                                </span>
                            </p>
                        </div>

                        {/* Username Input */}
                        <div className="mb-6">
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary">
                                    @
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value.replace(/\s/g, ""))
                                    }
                                    placeholder="username"
                                    className="w-full pl-8 pr-10 py-3.5 bg-background border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all text-lg"
                                    maxLength={20}
                                    autoFocus
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {status === "checking" && (
                                        <Loader2
                                            size={18}
                                            className="animate-spin text-textSecondary"
                                        />
                                    )}
                                    {status === "available" && (
                                        <Check size={18} className="text-green-400" />
                                    )}
                                    {(status === "taken" || status === "invalid") && (
                                        <X size={18} className="text-red-400" />
                                    )}
                                </div>
                            </div>

                            {errorMsg && (
                                <p className="text-red-400 text-xs mt-2">{errorMsg}</p>
                            )}
                            {status === "available" && (
                                <p className="text-green-400 text-xs mt-2">
                                    Username is available!
                                </p>
                            )}

                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-xs text-textSecondary mb-1.5">
                                        Try instead:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestions.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setUsername(s)}
                                                className="px-2.5 py-1 bg-white/5 hover:bg-accent/20 rounded-lg text-xs text-white/70 hover:text-accent transition-colors border border-white/10"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rules */}
                        <div className="mb-6 p-3 bg-background/50 rounded-lg">
                            <p className="text-xs text-textSecondary leading-relaxed">
                                <span className="font-medium text-white/60">Rules:</span>{" "}
                                3–20 characters. Letters, numbers, and underscores only.
                                Cannot be all numbers.
                            </p>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={status !== "available" || saving}
                            className="w-full py-3.5 bg-accent text-background rounded-xl font-bold text-lg hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </span>
                            ) : (
                                "Continue"
                            )}
                        </button>
                    </div>
                </div>
        </main>
    );
}
