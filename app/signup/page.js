"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Chrome, Check, X, Loader2 } from "lucide-react";
import { validateUsername } from "@/lib/slugify";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [username, setUsername] = useState("");
    const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'
    const [usernameError, setUsernameError] = useState("");
    const [usernameSuggestions, setUsernameSuggestions] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { signUp, signInWithGoogle, getAuthErrorMessage } = useAuth();
    const router = useRouter();
    const usernameCheckTimeout = useRef(null);

    // Real-time username validation and availability check
    useEffect(() => {
        if (usernameCheckTimeout.current) {
            clearTimeout(usernameCheckTimeout.current);
        }

        if (!username.trim()) {
            setUsernameStatus(null);
            setUsernameError("");
            setUsernameSuggestions([]);
            return;
        }

        // Client-side validation first
        const validation = validateUsername(username);
        if (!validation.valid) {
            setUsernameStatus('invalid');
            setUsernameError(validation.error);
            setUsernameSuggestions([]);
            return;
        }

        // Debounced server check
        setUsernameStatus('checking');
        usernameCheckTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch('/api/auth/check-username', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username }),
                });
                const data = await res.json();

                if (data.available) {
                    setUsernameStatus('available');
                    setUsernameError("");
                    setUsernameSuggestions([]);
                } else {
                    setUsernameStatus('taken');
                    setUsernameError(data.error || "Username is taken");
                    setUsernameSuggestions(data.suggestions || []);
                }
            } catch {
                setUsernameStatus(null);
                setUsernameError("Could not verify username");
            }
        }, 500);

        return () => {
            if (usernameCheckTimeout.current) {
                clearTimeout(usernameCheckTimeout.current);
            }
        };
    }, [username]);

    const handleSignup = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }
        if (password.length < 6) {
            return setError("Password must be at least 6 characters");
        }
        if (username.trim() && usernameStatus !== 'available') {
            return setError("Please choose a valid, available username");
        }

        setLoading(true);
        setError("");
        try {
            await signUp(email, password, undefined, username.trim() || undefined);
            router.replace("/");
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setGoogleLoading(true);
        setError("");
        try {
            const result = await signInWithGoogle();
            if (result?.isNewUser || result?.user?.needsUsername) {
                router.replace("/onboarding/username");
            } else {
                router.replace("/");
            }
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setGoogleLoading(false);
        }
    };

    const getUsernameStatusIcon = () => {
        switch (usernameStatus) {
            case 'checking':
                return <Loader2 size={16} className="animate-spin text-textSecondary" />;
            case 'available':
                return <Check size={16} className="text-green-400" />;
            case 'taken':
            case 'invalid':
                return <X size={16} className="text-red-400" />;
            default:
                return null;
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center pt-24 bg-background">
            <div className="w-full max-w-md mx-auto px-6 py-10">
                <div className="bg-secondary p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
                    <h1 className="text-3xl md:text-4xl font-black mb-2 text-center text-accent">
                        JOIN VIEWNOTE
                    </h1>
                    <p className="text-textSecondary text-center mb-6 md:mb-8">
                        Start your cinematic journey today.
                    </p>

                        <form onSubmit={handleSignup} className="space-y-4">
                            {/* Username Field */}
                            <div>
                                <label className="block text-sm font-medium text-textSecondary mb-1.5">
                                    Username
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Pick a unique username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                                        className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all pr-10"
                                        maxLength={20}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {getUsernameStatusIcon()}
                                    </div>
                                </div>
                                {usernameError && (
                                    <p className="text-warning text-xs mt-1">{usernameError}</p>
                                )}
                                {usernameStatus === 'available' && (
                                    <p className="text-green-400 text-xs mt-1">Username is available!</p>
                                )}
                                {usernameSuggestions.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-textSecondary mb-1">Try instead:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {usernameSuggestions.map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => setUsername(s)}
                                                    className="px-2 py-1 bg-white/5 hover:bg-accent/20 rounded-md text-xs text-white/70 hover:text-accent transition-colors border border-white/10"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Input
                                label="Email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Input
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Input
                                label="Confirm Password"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />

                            {error && (
                                <p className="text-warning text-sm font-medium">{error}</p>
                            )}

                            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                                {loading ? "Creating Account..." : "Create Account"}
                            </Button>
                        </form>

                        <div className="relative my-6 md:my-8">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-secondary px-2 text-textSecondary uppercase tracking-widest font-bold">
                                    Or sign up with
                                </span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleGoogleSignup}
                            disabled={loading || googleLoading}
                        >
                            <Chrome size={20} className="mr-2" />
                            {googleLoading ? "Signing up..." : "Google"}
                        </Button>

                    <p className="mt-6 md:mt-8 text-center text-textSecondary text-sm md:text-base">
                        Already have an account?{" "}
                        <Link
                            href="/login"
                            className="text-accent font-bold hover:underline"
                        >
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
