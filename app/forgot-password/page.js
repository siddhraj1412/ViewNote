"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { resetPassword, getAuthErrorMessage } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await resetPassword(email);
            setSent(true);
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center pt-24 bg-background">
            <div className="w-full max-w-md mx-auto px-6 py-10">
                <div className="bg-secondary p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
                    {sent ? (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                                    <CheckCircle className="text-accent" size={32} />
                                </div>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black mb-2 text-center">
                                CHECK YOUR EMAIL
                            </h1>
                            <p className="text-textSecondary text-center mb-6">
                                We sent a password reset link to{" "}
                                <span className="text-white font-semibold">{email}</span>.
                                Check your inbox and follow the instructions.
                            </p>
                            <p className="text-textSecondary text-center text-sm mb-6">
                                Didn&apos;t receive it? Check your spam folder or try again.
                            </p>
                            <div className="space-y-3">
                                <Button
                                    className="w-full"
                                    onClick={() => { setSent(false); setEmail(""); }}
                                >
                                    Try Another Email
                                </Button>
                                <Link href="/login" className="block">
                                    <Button variant="outline" className="w-full">
                                        <ArrowLeft size={16} className="mr-2" />
                                        Back to Sign In
                                    </Button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                                    <Mail className="text-accent" size={32} />
                                </div>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black mb-2 text-center">
                                RESET PASSWORD
                            </h1>
                            <p className="text-textSecondary text-center mb-6 md:mb-8">
                                Enter your email and we&apos;ll send you a link to reset your password.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />

                                {error && (
                                    <p className="text-warning text-sm font-medium">{error}</p>
                                )}

                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? "Sending..." : "Send Reset Link"}
                                </Button>
                            </form>

                            <p className="mt-6 text-center text-textSecondary text-sm md:text-base">
                                Remember your password?{" "}
                                <Link
                                    href="/login"
                                    className="text-accent font-bold hover:underline"
                                >
                                    Sign In
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
