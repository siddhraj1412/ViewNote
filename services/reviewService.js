import supabase from "@/lib/supabase";
import eventBus from "@/lib/eventBus";

/**
 * Like/unlike a review. Uses deterministic doc ID to prevent duplicate likes.
 * Also updates the likeCount field on the review doc for sorting reviews by popularity.
 */
export const reviewService = {
    // Like doc ID = `{reviewDocId}_{userId}`
    getLikeId(reviewDocId, userId) {
        return `${reviewDocId}_${userId}`;
    },

    async toggleLike(reviewDocId, user) {
        if (!user) return { liked: false, count: 0 };

        try {
            const { data, error } = await supabase.rpc('toggle_review_like', {
                p_review_doc_id: reviewDocId,
                p_user_id: user.uid,
                p_username: user.username || "",
                p_photo_url: user.photoURL || "",
            });

            if (error) {
                console.error("Error toggling like:", error);
                throw error;
            }

            // RPC RETURNS TABLE(liked, count) — data is an array of rows
            const row = Array.isArray(data) ? data[0] : data;
            const likedNow = row?.liked ?? false;
            const count = row?.count ?? await this.getLikeCount(reviewDocId);

            // Emit event so the media page can refresh stats if needed
            eventBus.emit("REVIEW_LIKE_UPDATED", { reviewDocId, liked: likedNow, count });

            return { liked: likedNow, count };
        } catch (error) {
            console.error("Error toggling like:", error);
            throw error;
        }
    },

    async getLikeCount(reviewDocId) {
        try {
            const { count, error } = await supabase
                .from("review_likes")
                .select('*', { count: 'exact', head: true })
                .eq("reviewDocId", reviewDocId);

            if (error) return 0;
            return count || 0;
        } catch {
            return 0;
        }
    },

    async hasUserLiked(reviewDocId, userId) {
        if (!userId) return false;
        const likeId = this.getLikeId(reviewDocId, userId);
        try {
            const { data, error } = await supabase
                .from("review_likes")
                .select('id')
                .eq('id', likeId)
                .single();

            if (error && error.code === 'PGRST116') return false;
            return !!data;
        } catch {
            return false;
        }
    },

    async getReviewLikeState(reviewDocId, userId) {
        const [liked, count] = await Promise.all([
            this.hasUserLiked(reviewDocId, userId),
            this.getLikeCount(reviewDocId),
        ]);
        return { liked, count };
    },

    // ── Comments ──
    async addComment(reviewDocId, user, text) {
        if (!user || !text?.trim()) return null;
        const trimmed = text.trim().substring(0, 1000);

        try {
            const { data, error } = await supabase
                .from("review_comments")
                .insert({
                    reviewDocId,
                    userId: user.uid,
                    username: user.username || "",
                    photoURL: user.photoURL || "",
                    displayName: user.displayName || user.username || "",
                    text: trimmed,
                    createdAt: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) {
                console.error("Error adding comment:", error);
                throw error;
            }

            return {
                id: data.id,
                userId: user.uid,
                username: user.username || "",
                photoURL: user.photoURL || "",
                displayName: user.displayName || "",
                text: trimmed,
                createdAt: new Date(),
            };
        } catch (error) {
            console.error("Error adding comment:", error);
            throw error;
        }
    },

    async getComments(reviewDocId) {
        try {
            const { data, error } = await supabase
                .from("review_comments")
                .select('*')
                .eq("reviewDocId", reviewDocId)
                .order("createdAt", { ascending: false });

            if (error) {
                console.error("Error fetching comments:", error);
                return [];
            }

            return (data || []).map((d) => ({
                ...d,
                createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            }));
        } catch (error) {
            console.error("Error fetching comments:", error);
            return [];
        }
    },

    async deleteComment(commentId, userId) {
        if (!userId) return false;
        try {
            // Verify ownership first
            const { data: comment, error: fetchError } = await supabase
                .from("review_comments")
                .select('userId')
                .eq('id', commentId)
                .single();

            if (fetchError || !comment || comment.userId !== userId) return false;

            const { error } = await supabase
                .from("review_comments")
                .delete()
                .eq('id', commentId);

            if (error) {
                console.error("Error deleting comment:", error);
                return false;
            }

            return true;
        } catch (error) {
            console.error("Error deleting comment:", error);
            return false;
        }
    },

    /**
     * Batch-fetch like states (liked + count) for multiple reviews in 2 queries
     * instead of 2N individual queries.
     */
    async getBatchLikeStates(reviewIds, userId) {
        if (!reviewIds.length) return {};

        try {
            // 1) All likes for these reviews (just reviewDocId column)
            const { data: allLikes } = await supabase
                .from("review_likes")
                .select("reviewDocId")
                .in("reviewDocId", reviewIds);

            // Count per review
            const counts = {};
            for (const l of allLikes || []) {
                counts[l.reviewDocId] = (counts[l.reviewDocId] || 0) + 1;
            }

            // 2) Which ones the current user liked
            let userLikedSet = new Set();
            if (userId) {
                const likeIds = reviewIds.map((rid) => `${rid}_${userId}`);
                const { data: userLikes } = await supabase
                    .from("review_likes")
                    .select("reviewDocId")
                    .in("id", likeIds);
                userLikedSet = new Set((userLikes || []).map((l) => l.reviewDocId));
            }

            const result = {};
            for (const rid of reviewIds) {
                result[rid] = { liked: userLikedSet.has(rid), count: counts[rid] || 0 };
            }
            return result;
        } catch (err) {
            console.error("[ReviewService] getBatchLikeStates error:", err);
            return {};
        }
    },

    /**
     * Batch-fetch comment counts for multiple reviews in 1 query.
     */
    async getBatchCommentCounts(reviewIds) {
        if (!reviewIds.length) return {};
        try {
            const { data } = await supabase
                .from("review_comments")
                .select("reviewDocId")
                .in("reviewDocId", reviewIds);

            const counts = {};
            for (const c of data || []) {
                counts[c.reviewDocId] = (counts[c.reviewDocId] || 0) + 1;
            }
            return counts;
        } catch (err) {
            console.error("[ReviewService] getBatchCommentCounts error:", err);
            return {};
        }
    },

    async deleteReviewThread(reviewDocId) {
        if (!reviewDocId) return { likesDeleted: 0, commentsDeleted: 0 };
        try {
            // Count before deleting
            const { count: likesCount } = await supabase
                .from("review_likes")
                .select('*', { count: 'exact', head: true })
                .eq("reviewDocId", reviewDocId);

            const { count: commentsCount } = await supabase
                .from("review_comments")
                .select('*', { count: 'exact', head: true })
                .eq("reviewDocId", reviewDocId);

            // Delete all likes for this review
            await supabase
                .from("review_likes")
                .delete()
                .eq("reviewDocId", reviewDocId);

            // Delete all comments for this review
            await supabase
                .from("review_comments")
                .delete()
                .eq("reviewDocId", reviewDocId);

            return { likesDeleted: likesCount || 0, commentsDeleted: commentsCount || 0 };
        } catch (error) {
            console.error("[ReviewService] deleteReviewThread error:", error);
            return { likesDeleted: 0, commentsDeleted: 0 };
        }
    },
};
