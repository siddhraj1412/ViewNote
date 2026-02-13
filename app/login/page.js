"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Chrome } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { signIn, signInWithGoogle, getFirebaseErrorMessage } = useAuth();
    const router = useRouter();

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await signIn(email, password);
            router.replace("/");
        } catch (err) {
            setError(getFirebaseErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
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
            setError(getFirebaseErrorMessage(err));
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 pt-24 bg-background">
            <div className="w-full max-w-md">
                <div className="bg-secondary p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
                    <h1 className="text-3xl md:text-4xl font-black mb-2 text-center">
                        WELCOME BACK
                    </h1>
                    <p className="text-textSecondary text-center mb-6 md:mb-8">
                        Pick up right where you left off.
                    </p>

                    <form onSubmit={handleEmailLogin} className="space-y-4">
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

                        {error && (
                            <p className="text-warning text-sm font-medium">{error}</p>
                        )}

                        <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>
                    </form>

                    <div className="relative my-6 md:my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-secondary px-2 text-textSecondary uppercase tracking-widest font-bold">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGoogleLogin}
                        disabled={loading || googleLoading}
                    >
                        <Chrome size={20} className="mr-2" />
                        {googleLoading ? "Signing in..." : "Google"}
                    </Button>

                    <p className="mt-6 md:mt-8 text-center text-textSecondary text-sm md:text-base">
                        Don't have an account?{" "}
                        <Link
                            href="/signup"
                            className="text-accent font-bold hover:underline"
                        >
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
