"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Film, Search, User, LogOut } from "lucide-react";

export default function Navbar() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <nav className="bg-secondary border-b border-background sticky top-0 z-40">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold">
                        <Film className="text-accent" size={28} />
                        <span>ViewNote</span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center gap-6">
                        <Link href="/search" className="hover:text-accent transition">
                            <Search size={20} />
                        </Link>

                        {user ? (
                            <>
                                <Link href="/profile" className="hover:text-accent transition">
                                    Profile
                                </Link>
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center gap-2 hover:text-accent transition"
                                >
                                    <LogOut size={18} />
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className="hover:text-accent transition">
                                    Sign In
                                </Link>
                                <Link
                                    href="/signup"
                                    className="bg-accent text-background px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Icon */}
                    <div className="md:hidden">
                        {user ? (
                            <Link href="/profile">
                                <User size={24} />
                            </Link>
                        ) : (
                            <Link href="/login" className="text-accent">
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
