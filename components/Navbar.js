"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Search, User, Settings, LogOut,
    BookOpen, List, Star, Bookmark, Clapperboard
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "./SearchOverlay";
import useScrollDirection from "@/hooks/useScrollDirection";
import { getProfileUrl } from "@/lib/slugify";

function NavbarContent() {
    const [showSearch, setShowSearch] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const scrollDirection = useScrollDirection();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            setScrolled(scrollY > 20);
            setIsFixed(scrollY > 100);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownOpen]);

    // Close dropdown on route change
    useEffect(() => {
        setDropdownOpen(false);
    }, [pathname, searchParams]);

    // Listen for toast navigation events (client-side nav)
    useEffect(() => {
        const handler = (e) => {
            const href = e.detail?.href;
            if (href) router.push(href);
        };
        window.addEventListener("toast-navigate", handler);
        return () => window.removeEventListener("toast-navigate", handler);
    }, [router]);

    const handleLogout = async () => {
        setDropdownOpen(false);
        try {
            await logout();
            // Clear any cached data
            if (typeof window !== 'undefined') {
                sessionStorage.clear();
            }
            router.push("/");
        } catch (err) {
            console.error("Logout error:", err);
            // Force redirect even if logout fails
            router.push("/");
        }
    };

    const getDropdownItems = () => {
        if (!user) return [];
        const profileIdentifier = user.username || user.uid;
        return [
            { label: "Profile", icon: User, href: getProfileUrl(profileIdentifier) },
            { label: "Watchlist", icon: Bookmark, href: getProfileUrl(profileIdentifier, 'watchlist') },
            { label: "Reviews", icon: Star, href: getProfileUrl(profileIdentifier, 'reviews') },
            { label: "Diary", icon: BookOpen, href: getProfileUrl(profileIdentifier, 'diary') },
            { label: "Lists", icon: List, href: getProfileUrl(profileIdentifier, 'lists') },
            { label: "Settings", icon: Settings, href: "/settings" },
        ];
    };

    const dropdownItems = getDropdownItems();

    const isDropdownItemActive = (item) => {
        if (item.href === "/settings") return pathname === "/settings";
        const [path, qs] = item.href.split("?");
        const isProfilePage = pathname === path || pathname.startsWith("/profile/") || pathname === `/${user?.username}`;
        if (!isProfilePage) return false;
        if (!qs) return !searchParams.get("tab");
        const tabParam = new URLSearchParams(qs).get("tab");
        return searchParams.get("tab") === tabParam;
    };

    const handleDropdownKeyDown = (e) => {
        if (e.key === "Escape") {
            setDropdownOpen(false);
        }
    };

    return (
        <>
            <nav
                className={`${isFixed ? 'fixed' : 'absolute'} top-0 left-0 right-0 z-[10000] transition-all duration-300 ${scrollDirection === "down" ? "-translate-y-full" : "translate-y-0"
                    }`}
                style={{
                    backgroundColor: scrolled ? "rgba(0, 0, 0, 0.2)" : "transparent",
                    backdropFilter: scrolled ? "blur(10px)" : "none",
                    WebkitBackdropFilter: scrolled ? "blur(10px)" : "none",
                }}
            >
                <div className="site-container">
                    <div className="flex items-center justify-between h-16">
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-3xl font-bold hover:text-accent transition-all group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                                <Clapperboard size={18} className="text-accent" />
                            </div>
                            <span className="drop-shadow-lg">ViewNote</span>
                        </Link>



                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSearch(true)}
                                className="p-2.5 hover:bg-white/10 rounded-xl transition-all backdrop-blur-sm"
                                aria-label="Search"
                            >
                                <Search size={20} />
                            </button>

                            {user ? (
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm"
                                        aria-haspopup="true"
                                        aria-expanded={dropdownOpen}
                                    >
                                        {user.photoURL ? (
                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 relative">
                                                <img
                                                    src={user.photoURL}
                                                    alt="Avatar"
                                                    className="w-full h-full object-cover aspect-square"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.username || user.displayName || user.email?.split("@")[0] || "U") + "&background=random";
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-1 bg-white/10 rounded-full">
                                                <User size={20} className="text-white/70" />
                                            </div>
                                        )}
                                        <span className="text-sm font-medium">
                                            {user.username || user.displayName || user.email?.split("@")[0]}
                                        </span>
                                        <svg
                                            className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {dropdownOpen && (
                                        <div
                                            className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200"
                                            style={{
                                                backgroundColor: "rgba(20, 20, 30, 0.95)",
                                                backdropFilter: "blur(20px)",
                                                WebkitBackdropFilter: "blur(20px)",
                                                zIndex: 10000,
                                            }}
                                            role="menu"
                                            onKeyDown={handleDropdownKeyDown}
                                        >
                                            <div className="px-4 py-3 border-b border-white/10">
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {user.username || user.displayName || user.email?.split("@")[0]}
                                                </p>
                                            </div>

                                            <div className="py-1">
                                                {dropdownItems.map((item) => {
                                                    const Icon = item.icon;
                                                    const isActive = isDropdownItemActive(item);
                                                    return (
                                                        <Link
                                                            key={item.label}
                                                            href={item.href}
                                                            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isActive
                                                                ? "bg-accent/15 text-accent"
                                                                : "text-white/80 hover:bg-white/10 hover:text-white"
                                                                }`}
                                                            role="menuitem"
                                                            onClick={() => setDropdownOpen(false)}
                                                        >
                                                            <Icon size={16} className="flex-shrink-0" />
                                                            <span>{item.label}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </div>

                                            <div className="border-t border-white/10 py-1">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                    role="menuitem"
                                                >
                                                    <LogOut size={16} className="flex-shrink-0" />
                                                    <span>Logout</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
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

            <SearchOverlay isOpen={showSearch} onClose={() => setShowSearch(false)} />
        </>
    );
}

export default function Navbar() {
    return (
        <Suspense fallback={null}>
            <NavbarContent />
        </Suspense>
    );
}
