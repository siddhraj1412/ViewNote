"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Search, User, Menu, X } from "lucide-react";
import { useState } from "react";
import Button from "./ui/Button";

export default function Navbar() {
    const { user } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                        <span className="text-background font-black text-xl">V</span>
                    </div>
                    <span className="text-2xl font-black tracking-tighter hidden sm:block">
                        VIEWNOTE
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    <Link
                        href="/search"
                        className="text-textSecondary hover:text-accent transition"
                    >
                        <Search size={24} />
                    </Link>

                    {user ? (
                        <Link
                            href="/profile"
                            className="flex items-center gap-2 text-textSecondary hover:text-accent transition"
                        >
                            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                                <User size={18} />
                            </div>
                            <span className="font-medium">
                                {user.displayName || user.email?.split("@")[0]}
                            </span>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link
                                href="/login"
                                className="text-textSecondary hover:text-textPrimary font-medium"
                            >
                                Sign In
                            </Link>
                            <Link href="/signup">
                                <Button size="sm">Get Started</Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-textPrimary"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Mobile Nav Overlay */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-20 left-0 right-0 bg-secondary p-4 space-y-4 border-b border-white/5 animate-slide-down">
                    <Link
                        href="/search"
                        className="flex items-center gap-3 p-3 text-lg"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <Search /> Search
                    </Link>
                    {user ? (
                        <Link
                            href="/profile"
                            className="flex items-center gap-3 p-3 text-lg"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <User /> Profile
                        </Link>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                                <Button variant="secondary" className="w-full">
                                    Sign In
                                </Button>
                            </Link>
                            <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                                <Button className="w-full">Get Started</Button>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
}
