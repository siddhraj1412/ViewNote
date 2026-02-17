"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { followService } from "@/services/followService";

/**
 * useFollow – hook for follow/unfollow with optimistic UI.
 *
 * @param {string} targetUserId – the user being followed/unfollowed
 * @returns {{ isFollowing, loading, followersCount, followingCount, toggleFollow }}
 */
export function useFollow(targetUserId) {
    const { user } = useAuth();
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    // Fetch initial state
    useEffect(() => {
        if (!targetUserId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const init = async () => {
            setLoading(true);
            try {
                const [following, counts] = await Promise.all([
                    user?.uid ? followService.isFollowing(user.uid, targetUserId) : false,
                    followService.getCounts(targetUserId),
                ]);
                if (cancelled) return;
                setIsFollowing(following);
                setFollowersCount(counts.followers);
                setFollowingCount(counts.following);
            } catch (err) {
                console.error("useFollow init error:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        init();
        return () => { cancelled = true; };
    }, [user?.uid, targetUserId]);

    const toggleFollow = useCallback(async () => {
        if (!user?.uid || !targetUserId || user.uid === targetUserId || toggling) return;

        setToggling(true);
        const wasFollowing = isFollowing;

        // Optimistic UI
        setIsFollowing(!wasFollowing);
        setFollowersCount((c) => c + (wasFollowing ? -1 : 1));

        try {
            if (wasFollowing) {
                await followService.unfollow(user.uid, targetUserId);
            } else {
                await followService.follow(user.uid, targetUserId);
            }
        } catch (err) {
            // Revert on error
            console.error("toggleFollow error:", err);
            setIsFollowing(wasFollowing);
            setFollowersCount((c) => c + (wasFollowing ? 1 : -1));
        } finally {
            setToggling(false);
        }
    }, [user?.uid, targetUserId, isFollowing, toggling]);

    return {
        isFollowing,
        loading,
        toggling,
        followersCount,
        followingCount,
        toggleFollow,
    };
}
