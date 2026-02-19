"use client";

import { useState, useEffect } from "react";
import supabase from "@/lib/supabase";
import { Globe, ExternalLink } from "lucide-react";
import eventBus from "@/lib/eventBus";

/**
 * Social link platform icons & detection
 */
const PLATFORMS = [
    { key: "twitter", pattern: /twitter\.com|x\.com/i, label: "Twitter/X", icon: "𝕏" },
    { key: "instagram", pattern: /instagram\.com/i, label: "Instagram", icon: "📷" },
    { key: "threads", pattern: /threads\.net/i, label: "Threads", icon: "🧵" },
    { key: "snapchat", pattern: /snapchat\.com/i, label: "Snapchat", icon: "👻" },
    { key: "letterboxd", pattern: /letterboxd\.com/i, label: "Letterboxd", icon: "🎬" },
    { key: "github", pattern: /github\.com/i, label: "GitHub", icon: "🐙" },
    { key: "youtube", pattern: /youtube\.com|youtu\.be/i, label: "YouTube", icon: "▶️" },
    { key: "tiktok", pattern: /tiktok\.com/i, label: "TikTok", icon: "🎵" },
    { key: "twitch", pattern: /twitch\.tv/i, label: "Twitch", icon: "🎮" },
    { key: "reddit", pattern: /reddit\.com/i, label: "Reddit", icon: "🔴" },
    { key: "discord", pattern: /discord\.(gg|com)/i, label: "Discord", icon: "💬" },
    { key: "spotify", pattern: /spotify\.com/i, label: "Spotify", icon: "🎧" },
    { key: "linkedin", pattern: /linkedin\.com/i, label: "LinkedIn", icon: "💼" },
    { key: "facebook", pattern: /facebook\.com/i, label: "Facebook", icon: "📘" },
    { key: "imdb", pattern: /imdb\.com/i, label: "IMDb", icon: "🎞️" },
    { key: "trakt", pattern: /trakt\.tv/i, label: "Trakt", icon: "📺" },
    { key: "mal", pattern: /myanimelist\.net/i, label: "MAL", icon: "🌸" },
    { key: "anilist", pattern: /anilist\.co/i, label: "AniList", icon: "📋" },
];

function detectPlatform(url) {
    for (const p of PLATFORMS) {
        if (p.pattern.test(url)) return p;
    }
    return null;
}

function getDisplayUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "");
    } catch {
        return url;
    }
}

/**
 * ProfileSocialLinks – displays location + social links on profile.
 * Data from user_profiles: { location, socialLinks: [{ url }] }
 */
export default function ProfileSocialLinks({ userId }) {
    const [location, setLocation] = useState("");
    const [socialLinks, setSocialLinks] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();
            if (data) {
                setLocation(data.location || "");
                setSocialLinks(data.socialLinks || []);
            }
        } catch (err) {
            console.error("Error loading social links:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userId]);

    useEffect(() => {
        const handler = () => loadData();
        eventBus.on("PROFILE_UPDATED", handler);
        return () => eventBus.off("PROFILE_UPDATED", handler);
    }, [userId]);

    if (loading) return null;
    if (!location && socialLinks.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-3 mt-1">
            {location && (
                <span className="flex items-center gap-1 text-white/60 text-sm">
                    <span className="text-sm">📍</span>
                    {location}
                </span>
            )}
            {socialLinks.map((link, i) => {
                const platform = detectPlatform(link.url);
                return (
                    <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-white/60 hover:text-accent text-sm transition"
                        title={link.url}
                    >
                        {platform ? (
                            <>
                                <span className="text-xs">{platform.icon}</span>
                                <span className="text-xs">{platform.label}</span>
                            </>
                        ) : (
                            <>
                                <Globe size={13} />
                                <span className="max-w-[160px] truncate text-xs">{getDisplayUrl(link.url)}</span>
                            </>
                        )}
                    </a>
                );
            })}
        </div>
    );
}
