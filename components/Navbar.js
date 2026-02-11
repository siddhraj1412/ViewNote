"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, Film, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "./SearchOverlay";
import useScrollDirection from "@/hooks/useScrollDirection";

export default function Navbar() {
    const [showSearch, setShowSearch] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const { user } = useAuth();
    const pathname = usePathname();
    const scrollDirection = useScrollDirection();

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            setScrolled(scrollY > 20);
            setIsFixed(scrollY > 100);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            {/* True Overlay Header */}
            <nav
                className={`${isFixed ? 'fixed' : 'absolute'} top-0 left-0 right-0 z-[9999] transition-all duration-300 ${scrollDirection === "down" ? "-translate-y-full" : "translate-y-0"
                    }`}
                style={{
                    backgroundColor: scrolled ? "rgba(0, 0, 0, 0.2)" : "transparent",
                    backdropFilter: scrolled ? "blur(10px)" : "none",
                    WebkitBackdropFilter: scrolled ? "blur(10px)" : "none",
                }}
            >
                <div className="container mx-auto px-6">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-2xl font-bold hover:text-accent transition-all group"
                        >
                            <Film className="text-accent transition-colors" size={28} />
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
                                    <Link
                                        href="/settings"
                                        className="p-2.5 hover:bg-white/10 rounded-xl transition-all backdrop-blur-sm"
                                        aria-label="Settings"
                                    >
                                        <Settings size={18} />
                                    </Link>
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

            {/* No spacer — header is overlay, sits ON banner */}

            {/* Search Overlay */}
            <SearchOverlay isOpen={showSearch} onClose={() => setShowSearch(false)} />
        </>
    );
}
