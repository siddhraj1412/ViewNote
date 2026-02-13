"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, Heart, Eye } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getMediaUrl } from "@/lib/slugify";
import StarRating from "@/components/StarRating";

const TMDB_IMG = "https://image.tmdb.org/t/p/w154";
const PAGE_SIZE = 50;

export default function DiarySection({ userId }) {
    const { user } = useAuth();
    const ownerId = userId || user?.uid;
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const backfilledIdsRef = useRef(new Set());

    useEffect(() => {
        if (!ownerId) {
            setEntries([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, "user_ratings"),
            where("userId", "==", ownerId),
            orderBy("createdAt", "desc"),
            limit(200)
        );

        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                setEntries(items);
                setLoading(false);

                const missing = snapshot.docs.filter((d) => {
                    if (backfilledIdsRef.current.has(d.id)) return false;
                    const data = d.data();
                    return !data?.createdAt;
                });

                if (missing.length > 0) {
                    const batch = writeBatch(db);
                    for (const d of missing) {
                        const data = d.data();
                        const createdAt = data?.ratedAt || serverTimestamp();
                        batch.set(doc(db, "user_ratings", d.id), { createdAt }, { merge: true });
                        backfilledIdsRef.current.add(d.id);
                    }
                    batch.commit().catch((e) => {
                        console.error("Error backfilling diary createdAt:", e);
                    });
                }
            },
            (error) => {
                console.error("Error loading diary:", error);
                setEntries([]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [ownerId]);

    const formatDate = (item) => {
        if (item.watchedDate) {
            return new Date(item.watchedDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
            });
        }
        const ts = item.createdAt || item.ratedAt;
        if (ts?.seconds) {
            return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
            });
        }
        return "";
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-secondary rounded-xl border border-white/5 animate-pulse">
                        <div className="w-12 h-18 rounded-lg bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-1/3" />
                            <div className="h-3 bg-white/10 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="text-center py-12">
                <Calendar size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                <p className="text-textSecondary mb-2">No diary entries yet</p>
                <p className="text-sm text-textSecondary opacity-70">
                    Rate movies and TV shows to build your diary
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Diary</h2>
                <span className="text-sm text-textSecondary">{entries.length} entries</span>
            </div>
            <div className="space-y-2">
                {(showAll ? entries : entries.slice(0, PAGE_SIZE)).map((item) => {
                    const url = getMediaUrl(
                        { id: item.mediaId, title: item.title, name: item.title },
                        item.mediaType
                    );
                    return (
                        <Link key={item.id} href={url} className="block">
                            <div className="flex items-center gap-4 p-3 md:p-4 bg-secondary rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                <div className="shrink-0">
                                    {item.poster_path ? (
                                        <img
                                            src={`${TMDB_IMG}${item.poster_path}`}
                                            alt={item.title}
                                            className="w-10 h-[60px] rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-[60px] rounded-lg bg-white/10" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white text-sm md:text-base truncate">{item.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-xs text-textSecondary">{formatDate(item)}</span>
                                        {item.rating > 0 && (
                                            <StarRating value={item.rating} size={12} readonly showHalfStars />
                                        )}
                                        {item.liked && (
                                            <Heart size={12} className="text-red-400" fill="currentColor" />
                                        )}
                                        {item.viewCount > 1 && (
                                            <span className="text-[10px] text-textSecondary flex items-center gap-0.5">
                                                <Eye size={10} />{item.viewCount}x
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs text-textSecondary capitalize shrink-0">{item.mediaType}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {!showAll && entries.length > PAGE_SIZE && (
                <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full py-2.5 text-sm font-medium text-accent hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                    Show all {entries.length} entries
                </button>
            )}
        </div>
    );
}
