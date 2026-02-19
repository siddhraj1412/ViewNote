"use client";

import { useState, useEffect } from "react";
import { MapPin, Link2, Plus, Trash2, Globe, Loader2 } from "lucide-react";
import supabase from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

/**
 * Sanitize URL — ensure it starts with https:// or http://
 */
function sanitizeUrl(url) {
    if (!url) return "";
    let trimmed = url.trim();
    if (!trimmed) return "";
    // If no protocol, add https://
    if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = "https://" + trimmed;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.href;
    } catch {
        return "";
    }
}

/**
 * SocialLinksEditor — edit location + unlimited social links
 */
export default function SocialLinksEditor() {
    const { user } = useAuth();
    const [location, setLocation] = useState("");
    const [socialLinks, setSocialLinks] = useState([]);
    const [newUrl, setNewUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        const loadData = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.uid)
                    .single();
                if (data) {
                    setLocation(data.location || "");
                    setSocialLinks(data.socialLinks || []);
                }
            } catch (err) {
                console.error("Error loading social data:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    const addLink = () => {
        const sanitized = sanitizeUrl(newUrl);
        if (!sanitized) {
            showToast.error("Please enter a valid URL");
            return;
        }
        // Check for duplicates
        if (socialLinks.some((l) => l.url === sanitized)) {
            showToast.error("This link already exists");
            return;
        }
        setSocialLinks((prev) => [...prev, { url: sanitized }]);
        setNewUrl("");
    };

    const removeLink = (index) => {
        setSocialLinks((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const payload = {
                location: location.trim(),
                socialLinks: socialLinks,
                updatedAt: new Date().toISOString(),
            };

            // Try update first
            const { error } = await supabase
                .from("profiles")
                .update(payload)
                .eq("id", user.uid);

            if (error) {
                console.error("Update error:", error);
                // Handle missing columns
                if (error.message?.includes("column") || error.code === "42703" || error.code === "PGRST204") {
                    showToast.error("Database migration needed — please run supabase-migration-fix.sql in Supabase SQL Editor.");
                    return;
                }
                // Fallback: upsert if row might not exist
                const { error: upsertError } = await supabase
                    .from("profiles")
                    .upsert({ id: user.uid, ...payload }, { onConflict: "id" });
                if (upsertError) {
                    console.error("Upsert error:", upsertError);
                    throw upsertError;
                }
            }

            // Re-fetch to confirm persistence
            const { data: verified, error: verifyError } = await supabase
                .from("profiles")
                .select("location, socialLinks")
                .eq("id", user.uid)
                .single();

            if (verifyError) {
                console.error("Verification error:", verifyError);
                throw verifyError;
            }

            if (verified) {
                setLocation(verified.location || "");
                setSocialLinks(verified.socialLinks || []);
            }

            eventBus.emit("PROFILE_UPDATED", { type: "social" });
            showToast.success("Social links saved successfully");
        } catch (err) {
            console.error("Error saving social links:", err);
            showToast.error(err?.message || "Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-secondary rounded-2xl p-5">
                <div className="text-sm text-textSecondary">Loading...</div>
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-2xl p-5 space-y-4">
            {/* Location */}
            <div>
                <label className="text-xs font-medium text-textSecondary uppercase tracking-wider mb-2 block">
                    Location
                </label>
                <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-accent flex-shrink-0" />
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. New York, USA"
                        maxLength={100}
                        className="w-full px-3 py-2 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                    />
                </div>
            </div>

            {/* Social Links */}
            <div>
                <label className="text-xs font-medium text-textSecondary uppercase tracking-wider mb-2 block">
                    Social Links
                </label>

                {socialLinks.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {socialLinks.map((link, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Globe size={14} className="text-textSecondary flex-shrink-0" />
                                <span className="text-sm text-white/80 truncate flex-1">{link.url}</span>
                                <button
                                    onClick={() => removeLink(i)}
                                    className="text-textSecondary hover:text-red-400 transition p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-accent flex-shrink-0" />
                    <input
                        type="text"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://twitter.com/username"
                        onKeyDown={(e) => e.key === "Enter" && newUrl.trim() && addLink()}
                        className="flex-1 px-3 py-2 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                    />
                    <button
                        onClick={addLink}
                        disabled={!newUrl.trim()}
                        className="px-3 py-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition disabled:opacity-30"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/85 transition disabled:opacity-50 flex items-center gap-1"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                    {saving ? "Saving…" : "Save Links"}
                </button>
            </div>
        </div>
    );
}
