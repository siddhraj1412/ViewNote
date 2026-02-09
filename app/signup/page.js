"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Chrome } from "lucide-react";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { signUp, signInWithGoogle } = useAuth();
    const router = useRouter();

    const handleSignup = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }
        if (password.length < 6) {
            return setError("Password must be at least 6 characters");
        }

        setLoading(true);
        setError("");
        try {
            await signUp(email, password);
            router.push("/profile");
        } catch (err) {
            setError("Failed to create account. Email may be already in use.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setGoogleLoading(true);
        setError("");
        try {
            await signInWithGoogle();
            router.push("/profile");
        } catch (err) {
            setError("Google sign up failed. Please try again.");
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <main className="min-h-[80vh] flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md">
                <div className="bg-secondary p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
                    <h1 className="text-3xl md:text-4xl font-black mb-2 text-center text-accent">
                        JOIN VIEWNOTE
                    </h1>
                    <p className="text-textSecondary text-center mb-6 md:mb-8">
                        Start your cinematic journey today.
                    </p>

                    <form onSubmit={handleSignup} className="space-y-4">
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
