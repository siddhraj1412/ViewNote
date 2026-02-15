"use client";

/**
 * Feature Verification System
 * Dev-only debug utilities for verifying rating aggregation, like updates,
 * pagination, sync status, and cache state.
 *
 * Usage: Import and render <FeatureDebugPanel /> on any page during development.
 * Only renders when NODE_ENV === "development".
 *
 * Or use the individual verification functions in the browser console:
 *   window.__viewNote.verifyStats("movie", 550)
 *   window.__viewNote.verifyLikes("reviewDocId")
 *   window.__viewNote.verifyCache()
 */

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { aggregateAndWriteStats } from "@/components/RatingDistribution";

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

// ── Console-accessible verification functions ──

async function verifyStats(mediaType, mediaId) {
    const statsKey = `${mediaType}_${String(mediaId)}`;
    console.group(`[FeatureVerify] Stats for ${statsKey}`);

    try {
        // Check media_stats doc
        const statsRef = doc(db, "media_stats", statsKey);
        const statsSnap = await getDoc(statsRef);

        if (statsSnap.exists()) {
            const data = statsSnap.data();
            console.log("✅ media_stats doc exists:", data);
            console.log("  ratingBuckets:", data.ratingBuckets || data.buckets || "MISSING");
            console.log("  totalRatings:", data.totalRatings);
            console.log("  totalReviews:", data.totalReviews);
            console.log("  totalWatchers:", data.totalWatchers);
            console.log("  totalLikes:", data.totalLikes);
            console.log("  lastUpdated:", data.lastUpdated);
        } else {
            console.warn("⚠️ media_stats doc does not exist. Triggering aggregation...");
            await aggregateAndWriteStats(mediaId, mediaType);
            console.log("✅ Aggregation complete. Re-check stats.");
        }

        // Cross-check with user_ratings
        const ratingsQ = query(
            collection(db, "user_ratings"),
            where("mediaId", "==", Number(mediaId))
        );
        const ratingsSnap = await getDocs(ratingsQ);
        const filtered = ratingsSnap.docs.filter((d) => d.data().mediaType === mediaType);
        console.log(`  Raw user_ratings for this media: ${filtered.length} docs`);

        const buckets = Object.fromEntries(BUCKETS.map((b) => [String(b), 0]));
        let countWithReview = 0;
        let countLiked = 0;
        filtered.forEach((d) => {
            const data = d.data();
            const r = Number(data.rating);
            if (r > 0 && r <= 5) {
                const bucket = Math.round(r * 2) / 2;
                const clamped = Math.max(0.5, Math.min(5, bucket));
                buckets[String(clamped)]++;
            }
            if (data.review?.trim()) countWithReview++;
            if (data.liked === true) countLiked++;
        });
        console.log("  Computed buckets from user_ratings:", buckets);
        console.log(`  Computed totalReviews: ${countWithReview}, totalLikes: ${countLiked}`);

        // Check user_watched count
        const watchedQ = query(
            collection(db, "user_watched"),
            where("mediaId", "==", Number(mediaId))
        );
        const watchedSnap = await getDocs(watchedQ);
        const watchedFiltered = watchedSnap.docs.filter((d) => d.data().mediaType === mediaType);
        console.log(`  Computed totalWatchers: ${watchedFiltered.length}`);
    } catch (error) {
        console.error("❌ Error verifying stats:", error);
    }

    console.groupEnd();
}

async function verifyLikes(reviewDocId) {
    console.group(`[FeatureVerify] Likes for review ${reviewDocId}`);
    try {
        const likesQ = query(
            collection(db, "review_likes"),
            where("reviewDocId", "==", reviewDocId)
        );
        const likesSnap = await getDocs(likesQ);
        console.log(`✅ Like count: ${likesSnap.size}`);
        likesSnap.docs.forEach((d) => {
            const data = d.data();
            console.log(`  - ${data.username || data.userId} (${d.id})`);
        });

        // Check likeCount on review doc
        const reviewRef = doc(db, "user_ratings", reviewDocId);
        const reviewSnap = await getDoc(reviewRef);
        if (reviewSnap.exists()) {
            const reviewData = reviewSnap.data();
            console.log(`  Review doc likeCount field: ${reviewData.likeCount ?? "not set"}`);
            if (Number(reviewData.likeCount || 0) !== likesSnap.size) {
                console.warn(`  ⚠️ Mismatch: likeCount=${reviewData.likeCount} vs actual=${likesSnap.size}`);
            }
        }
    } catch (error) {
        console.error("❌ Error verifying likes:", error);
    }
    console.groupEnd();
}

async function refreshStatsForMedia(mediaType, mediaId) {
    console.log(`[FeatureVerify] Forcing stats refresh for ${mediaType}_${mediaId}...`);
    const result = await aggregateAndWriteStats(mediaId, mediaType);
    if (result) {
        console.log("✅ Stats refreshed:", result);
    } else {
        console.error("❌ Stats refresh failed");
    }
    return result;
}

function verifyCache() {
    console.group("[FeatureVerify] Cache State");
    console.log("localStorage keys:", Object.keys(localStorage));
    console.log("sessionStorage keys:", Object.keys(sessionStorage));
    console.groupEnd();
}

// Register on window for console access
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    window.__viewNote = {
        verifyStats,
        verifyLikes,
        refreshStatsForMedia,
        verifyCache,
    };
}

// ── Debug Panel Component ──

export default function FeatureDebugPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [mediaType, setMediaType] = useState("movie");
    const [mediaId, setMediaId] = useState("");
    const [log, setLog] = useState([]);

    if (process.env.NODE_ENV !== "development") return null;

    const addLog = (msg) => setLog((prev) => [...prev.slice(-50), `${new Date().toLocaleTimeString()} ${msg}`]);

    const handleVerifyStats = async () => {
        if (!mediaId) return;
        addLog(`Verifying stats for ${mediaType}_${mediaId}...`);
        await verifyStats(mediaType, Number(mediaId));
        addLog("Stats verification complete — check console");
    };

    const handleRefreshStats = async () => {
        if (!mediaId) return;
        addLog(`Refreshing stats for ${mediaType}_${mediaId}...`);
        const result = await refreshStatsForMedia(mediaType, Number(mediaId));
        if (result) {
            addLog(`Stats refreshed: ratings=${result.totalRatings}, reviews=${result.totalReviews}, watchers=${result.totalWatchers}, likes=${result.totalLikes}`);
        } else {
            addLog("Stats refresh failed");
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[9999] bg-purple-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg hover:bg-purple-500 transition"
            >
                🔧 Debug
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl text-white text-xs">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <span className="font-bold text-sm">Feature Debug</span>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-3 space-y-3">
                <div className="flex gap-2">
                    <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs">
                        <option value="movie">Movie</option>
                        <option value="tv">TV</option>
                    </select>
                    <input
                        type="number"
                        value={mediaId}
                        onChange={(e) => setMediaId(e.target.value)}
                        placeholder="Media ID"
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs"
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={handleVerifyStats} className="flex-1 bg-blue-600 hover:bg-blue-500 rounded px-2 py-1.5 text-xs font-medium">Verify Stats</button>
                    <button onClick={handleRefreshStats} className="flex-1 bg-green-600 hover:bg-green-500 rounded px-2 py-1.5 text-xs font-medium">Refresh Stats</button>
                </div>
                <button onClick={verifyCache} className="w-full bg-gray-700 hover:bg-gray-600 rounded px-2 py-1.5 text-xs font-medium">Check Cache</button>
                {log.length > 0 && (
                    <div className="bg-black/50 rounded p-2 max-h-32 overflow-y-auto space-y-0.5">
                        {log.map((l, i) => (
                            <div key={i} className="text-[10px] text-gray-300 font-mono">{l}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
