import supabase from "@/lib/supabase";

/**
 * Follow System Service
 *
 * Supabase structure:
 *   user_follows: { id, followerId, followingId, createdAt }
 *   profiles: { id, followersCount, followingCount, ... }
 *
 * Uses RPC functions for atomic follow/unfollow with counter updates.
 */

const COLLECTION = "user_follows";

function getFollowDocId(followerId, followingId) {
    return `${followerId}_${followingId}`;
}

export const followService = {
    /**
     * Follow a user
     */
    async follow(followerId, followingId) {
        if (!followerId || !followingId || followerId === followingId) return false;

        try {
            const { error } = await supabase.rpc('follow_user', {
                p_follower_id: followerId,
                p_following_id: followingId,
            });

            if (error) {
                // Already following or other constraint violation
                if (error.code === '23505' || error.message?.includes('already')) return false;
                console.error("Error following user:", error);
                return false;
            }

            return true;
        } catch (error) {
            console.error("Error following user:", error);
            return false;
        }
    },

    /**
     * Unfollow a user
     */
    async unfollow(followerId, followingId) {
        if (!followerId || !followingId) return false;

        try {
            const { error } = await supabase.rpc('unfollow_user', {
                p_follower_id: followerId,
                p_following_id: followingId,
            });

            if (error) {
                console.error("Error unfollowing user:", error);
                return false;
            }

            return true;
        } catch (error) {
            console.error("Error unfollowing user:", error);
            return false;
        }
    },

    /**
     * Check if user A follows user B
     */
    async isFollowing(followerId, followingId) {
        if (!followerId || !followingId) return false;
        const docId = getFollowDocId(followerId, followingId);
        try {
            const { data, error } = await supabase
                .from(COLLECTION)
                .select('id')
                .eq('id', docId)
                .single();

            if (error && error.code === 'PGRST116') return false;
            return !!data;
        } catch {
            return false;
        }
    },

    /**
     * Get followers of a user (paginated)
     */
    async getFollowers(userId, pageSize = 24, lastDoc = null) {
        if (!userId) return { users: [], lastDoc: null, hasMore: false };

        // lastDoc is now an offset number for range-based pagination
        const offset = typeof lastDoc === 'number' ? lastDoc : 0;

        try {
            const { data: follows, error } = await supabase
                .from(COLLECTION)
                .select('*')
                .eq('followingId', userId)
                .order('createdAt', { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching followers:", error);
                return { users: [], lastDoc: null, hasMore: false };
            }

            const uids = (follows || []).map((d) => d.followerId);

            // Batch fetch all profiles in a single query instead of N+1
            let users = [];
            if (uids.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', uids);

                const profileMap = new Map((profiles || []).map(p => [p.id, p]));
                users = uids.map(uid => {
                    const profile = profileMap.get(uid);
                    return profile ? { uid, ...profile } : { uid, username: "Unknown" };
                });
            }

            const newOffset = offset + (follows || []).length;

            return {
                users,
                lastDoc: (follows || []).length > 0 ? newOffset : null,
                hasMore: (follows || []).length === pageSize,
            };
        } catch (error) {
            console.error("Error fetching followers:", error);
            return { users: [], lastDoc: null, hasMore: false };
        }
    },

    /**
     * Get users that a user is following (paginated)
     */
    async getFollowing(userId, pageSize = 24, lastDoc = null) {
        if (!userId) return { users: [], lastDoc: null, hasMore: false };

        const offset = typeof lastDoc === 'number' ? lastDoc : 0;

        try {
            const { data: follows, error } = await supabase
                .from(COLLECTION)
                .select('*')
                .eq('followerId', userId)
                .order('createdAt', { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching following:", error);
                return { users: [], lastDoc: null, hasMore: false };
            }

            const uids = (follows || []).map((d) => d.followingId);

            // Batch fetch all profiles in a single query instead of N+1
            let users = [];
            if (uids.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', uids);

                const profileMap = new Map((profiles || []).map(p => [p.id, p]));
                users = uids.map(uid => {
                    const profile = profileMap.get(uid);
                    return profile ? { uid, ...profile } : { uid, username: "Unknown" };
                });
            }

            const newOffset = offset + (follows || []).length;

            return {
                users,
                lastDoc: (follows || []).length > 0 ? newOffset : null,
                hasMore: (follows || []).length === pageSize,
            };
        } catch (error) {
            console.error("Error fetching following:", error);
            return { users: [], lastDoc: null, hasMore: false };
        }
    },

    /**
     * Get follower and following counts from the profile document
     */
    async getCounts(userId) {
        if (!userId) return { followers: 0, following: 0 };
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('followersCount, followingCount')
                .eq('id', userId)
                .single();

            if (error || !profile) return { followers: 0, following: 0 };

            return {
                followers: profile.followersCount || 0,
                following: profile.followingCount || 0,
            };
        } catch (e) {
            console.error("Error getting follow counts:", e);
            return { followers: 0, following: 0 };
        }
    },
};
