"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, LogOut, Film } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "./SearchOverlay";

export default function Navbar() {
    const [showSearch, setShowSearch] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { user, logout } = useAuth();
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <>
            {/* Cineb-style Transparent Glassmorphism Header */}
            <nav
                className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl transition-all duration-300 ${scrolled
                        ? "bg-black/60 backdrop-blur-xl shadow-2xl"
                        : "bg-black/40 backdrop-blur-lg shadow-xl"
                    }`}
                style={{
                    borderRadius: "16px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    willChange: "transform, opacity",
                }}
            >
                <div className="px-6">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-2xl font-bold hover:text-accent transition-all group"
                        >
                            <Film className="text-accent group-hover:scale-110 transition-transform" size={28} />
                            <span className="drop-shadow-lg">ViewNote</span>
                        </Link>

                        {/* Navigation Links - Centered */}
                        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                            <Link
                                href="/"
                                className={`hover:text-accent transition-all drop-shadow-lg ${pathname === "/" ? "text-accent font-semibold" : ""
                                    }`}
                            >
                                Home
                            </Link>
                            {user && (
                                <Link
                                    href="/profile"
                                    className={`hover:text-accent transition-all drop-shadow-lg ${pathname === "/profile" ? "text-accent font-semibold" : ""
                                        }`}
                                >
                                    Profile
                                </Link>
                            )}
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-3">
                            {/* Search Button */}
                            <button
                                onClick={() => setShowSearch(true)}
                                className="p-2.5 hover:bg-white/10 rounded-xl transition-all backdrop-blur-sm"
                                aria-label="Search"
                            >
                                <Search size={20} />
                            </button>

                            {/* User Menu */}
                            {user ? (
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/profile"
                                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm"
                                    >
                                        <User size={16} />
                                        <span className="text-sm font-medium">
                                            {user.displayName || user.email?.split("@")[0]}
                                        </span>
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="p-2.5 hover:bg-white/10 rounded-xl transition-all backdrop-blur-sm"
                                        aria-label="Logout"
                                    >
                                        <LogOut size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/login"
                                        className="px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-sm font-medium backdrop-blur-sm"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/signup"
                                        className="px-4 py-2 bg-accent hover:bg-accent/90 rounded-xl transition-all text-sm font-medium shadow-lg shadow-accent/20"
                                    >
                                        Sign Up
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Spacer for fixed header */}
            <div className="h-24" />

            {/* Search Overlay */}
            <SearchOverlay isOpen={showSearch} onClose={() => setShowSearch(false)} />
        </>
    );
}
