"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, LogOut, Film } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "./SearchOverlay";

export default function Navbar() {
    const [showSearch, setShowSearch] = useState(false);
    const { user, logout } = useAuth();
    const pathname = usePathname();

    // Header is now solid on all pages (non-transparent)

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <>
            {/* Navbar - Solid background on all pages */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-white/10">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-2xl font-bold hover:text-accent transition group"
                        >
                            <Film className="text-accent group-hover:scale-110 transition-transform" size={28} />
                            <span>ViewNote</span>
                        </Link>

                        {/* Navigation Links */}
                        <div className="hidden md:flex items-center gap-6">
                            <Link
                                href="/"
                                className={`hover:text-accent transition ${pathname === "/" ? "text-accent font-semibold" : ""}`}
                            >
                                Home
                            </Link>
                            {user && (
                                <Link
                                    href="/profile"
                                    className={`hover:text-accent transition ${pathname === "/profile" ? "text-accent font-semibold" : ""}`}
                                >
                                    Profile
                                </Link>
                            )}
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-4">
                            {/* Search Button */}
                            <button
                                onClick={() => setShowSearch(true)}
                                className="p-2 hover:bg-white/10 rounded-lg transition"
                                aria-label="Search"
                            >
                                <Search size={22} />
                            </button>

                            {/* User Menu */}
                            {user ? (
                                <div className="flex items-center gap-3">
                                    <Link
                                        href="/profile"
                                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                                    >
                                        <User size={18} />
                                        <span className="text-sm font-medium">
                                            {user.displayName || user.email?.split("@")[0]}
                                        </span>
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="p-2 hover:bg-white/10 rounded-lg transition"
                                        aria-label="Logout"
                                    >
                                        <LogOut size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/login"
                                        className="px-4 py-2 hover:bg-white/10 rounded-lg transition text-sm font-medium"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/signup"
                                        className="px-4 py-2 bg-accent hover:bg-accent/90 rounded-lg transition text-sm font-medium"
                                    >
                                        Sign Up
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


            </nav>

            {/* Search Overlay */}
            <SearchOverlay isOpen={showSearch} onClose={() => setShowSearch(false)} />
        </>
    );
}
