"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { followService } from "@/services/followService";
import { User } from "lucide-react";

const PAGE_SIZE = 24;

async function resolveUsernameToUid(username) {
    if (!username) return null;
    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.uid || null;
    } catch {
        return null;
    }
}

export default function FollowingPage() {
    const params = useParams();
    const username = params?.username ? decodeURIComponent(params.username) : "";

    const [uid, setUid] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState(null);

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            setLoadingUser(true);
            const id = await resolveUsernameToUid(username);
            if (!mounted) return;
            setUid(id);
            setLoadingUser(false);
        };
        run();
        return () => { mounted = false; };
    }, [username]);

    const loadFirst = useCallback(async (userId) => {
        if (!userId) return;
        setLoading(true);
        try {
            const result = await followService.getFollowing(userId, PAGE_SIZE, null);
            setUsers(result.users);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch {
            setUsers([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (uid) loadFirst(uid);
    }, [uid, loadFirst]);

    const loadMore = useCallback(async () => {
        if (!uid || !lastDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const result = await followService.getFollowing(uid, PAGE_SIZE, lastDoc);
            setUsers((prev) => [...prev, ...result.users]);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [uid, lastDoc, loadingMore, hasMore]);

    if (loadingUser) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!uid) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">User not found</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="site-container py-10">
                <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="min-w-0">
                        <h1 className="text-3xl md:text-4xl font-bold truncate">Following</h1>
                        <div className="text-sm text-textSecondary truncate">@{username}</div>
                    </div>
                    <Link
                        href={`/${encodeURIComponent(username)}`}
                        className="inline-flex px-4 py-2 text-sm font-semibold rounded-full border transition-colors bg-white/5 text-textSecondary border-white/10 hover:text-white"
                    >
                        Back
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-textSecondary">Loading following...</div>
                ) : users.length === 0 ? (
                    <div className="bg-secondary rounded-xl border border-white/5 p-6">
                        <div className="text-sm text-textSecondary">Not following anyone yet.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {users.map((u) => (
                            <Link
                                key={u.uid}
                                href={`/${encodeURIComponent(u.username || u.uid)}`}
                                className="flex items-center gap-3 p-4 bg-secondary rounded-xl border border-white/5 hover:border-white/10 transition-all"
                            >
                                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
                                    {u.profile_picture_url ? (
                                        <img src={u.profile_picture_url} alt={u.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={18} className="text-textSecondary" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{u.displayName || u.username || "User"}</p>
                                    <p className="text-xs text-textSecondary truncate">@{u.username || u.uid}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {hasMore && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white disabled:opacity-60"
                        >
                            {loadingMore ? "Loading..." : "Load more"}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
