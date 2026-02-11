"use client";

import { useState } from "react";

const SECTIONS = [
    { id: "profile", label: "Profile" },
    { id: "watching", label: "Watching" },
    { id: "watched", label: "Watched" },
    { id: "paused", label: "Paused" },
    { id: "dropped", label: "Dropped" },
    { id: "diary", label: "Diary" },
    { id: "reviews", label: "Reviews" },
    { id: "watchlist", label: "Watchlist" },
    { id: "lists", label: "Lists" },
    { id: "likes", label: "Likes" },
];

export default function ProfileTabs({ activeSection, onSectionChange }) {
    return (
        <div className="mb-4 overflow-x-auto">
            <div
                className="flex gap-6 min-w-max px-6 py-3 rounded-xl"
                style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                }}
            >
                {SECTIONS.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className={`px-4 py-2 font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${activeSection === section.id
                            ? "text-accent bg-accent/10"
                            : "text-textSecondary hover:text-textPrimary hover:bg-white/5"
                            }`}
                    >
                        {section.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
