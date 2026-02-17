"use client";

import { useState, useEffect } from "react";
import supabase from "@/lib/supabase";
import Link from "next/link";
import { Film, Tv } from "lucide-react";

/**
 * ProfileStats – Movies total + this year, Shows total + this year, Followers, Following
 */
export default function ProfileStats({ userId, followersCount = 0, followingCount = 0, username }) {
    const [movieCount, setMovieCount] = useState(0);
    const [movieThisYear, setMovieThisYear] = useState(0);
    const [showCount, setShowCount] = useState(0);
    const [showThisYear, setShowThisYear] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        const fetchStats = async () => {
            setLoading(true);
            try {
                const { data: watchedData, error } = await supabase
                    .from("user_watched")
                    .select("*")
                    .eq("userId", userId);

                const currentYear = new Date().getFullYear();
                let movies = 0, moviesYr = 0, shows = 0, showsYr = 0;

                (watchedData || []).forEach((data) => {
                    const type = data.mediaType;
                    const addedAt = data.addedAt ? new Date(data.addedAt) : null;
                    const isThisYear = addedAt && addedAt.getFullYear() === currentYear;

                    if (type === "movie") {
                        movies++;
                        if (isThisYear) moviesYr++;
                    } else if (type === "tv") {
                        shows++;
                        if (isThisYear) showsYr++;
                    }
                });

                if (!cancelled) {
                    setMovieCount(movies);
                    setMovieThisYear(moviesYr);
                    setShowCount(shows);
                    setShowThisYear(showsYr);
                }
            } catch (err) {
                console.error("Error fetching stats:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchStats();
        return () => { cancelled = true; };
    }, [userId]);

    if (loading) return null;

    const encodedUsername = encodeURIComponent(username || "");

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <StatItem icon={Film} label="Movies" count={movieCount} subCount={movieThisYear} />
            <StatItem icon={Tv} label="Shows" count={showCount} subCount={showThisYear} />
            <Link href={`/${encodedUsername}/followers`} className="hover:text-accent transition">
                <span className="text-sm">
                    <span className="font-bold text-white">{followersCount}</span>
                    <span className="text-white/60 ml-1">Followers</span>
                </span>
            </Link>
            <Link href={`/${encodedUsername}/following`} className="hover:text-accent transition">
                <span className="text-sm">
                    <span className="font-bold text-white">{followingCount}</span>
                    <span className="text-white/60 ml-1">Following</span>
                </span>
            </Link>
        </div>
    );
}

function StatItem({ icon: Icon, label, count, subCount }) {
    return (
        <div className="flex items-center gap-1.5 text-sm">
            <Icon size={14} className="text-accent" />
            <span className="font-bold text-white">{count}</span>
            <span className="text-white/60">{label}</span>
            {subCount > 0 && (
                <span className="text-white/40 text-xs">({subCount} this year)</span>
            )}
        </div>
    );
}
