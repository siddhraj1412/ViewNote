import supabase from "@/lib/supabase";

export const listService = {
    // ── Likes ──
    getLikeId(listId, userId) {
        return `${listId}_${userId}`;
    },

    async toggleLike(listId, user) {
        if (!user) return { liked: false, count: 0 };
        const likeId = this.getLikeId(listId, user.uid);

        try {
            // Check if like exists
            const { data: existing, error: fetchError } = await supabase
                .from("list_likes")
                .select('id')
                .eq('id', likeId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (existing) {
                // Unlike
                await supabase
                    .from("list_likes")
                    .delete()
                    .eq('id', likeId);

                const count = await this.getLikeCount(listId);
                return { liked: false, count };
            } else {
                // Like
                await supabase
                    .from("list_likes")
                    .insert({
                        id: likeId,
                        listId,
                        userId: user.uid,
                        username: user.username || "",
                        photoURL: user.photoURL || "",
                        createdAt: new Date().toISOString(),
                    });

                const count = await this.getLikeCount(listId);
                return { liked: true, count };
            }
        } catch (error) {
            console.error("Error toggling list like:", error);
            throw error;
        }
    },

    async getLikeCount(listId) {
        try {
            const { count, error } = await supabase
                .from("list_likes")
                .select('*', { count: 'exact', head: true })
                .eq("listId", listId);

            if (error) return 0;
            return count || 0;
        } catch {
            return 0;
        }
    },

    async hasUserLiked(listId, userId) {
        if (!userId) return false;
        try {
            const { data, error } = await supabase
                .from("list_likes")
                .select('id')
                .eq('id', this.getLikeId(listId, userId))
                .single();

            if (error && error.code === 'PGRST116') return false;
            return !!data;
        } catch {
            return false;
        }
    },

    async getLikeState(listId, userId) {
        const [liked, count] = await Promise.all([
            this.hasUserLiked(listId, userId),
            this.getLikeCount(listId),
        ]);
        return { liked, count };
    },

    // ── Comments ──
    async addComment(listId, user, text) {
        if (!user || !text?.trim()) return null;
        const trimmed = text.trim().substring(0, 1000);

        try {
            const { data, error } = await supabase
                .from("list_comments")
                .insert({
                    listId,
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
                console.error("Error adding list comment:", error);
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
            console.error("Error adding list comment:", error);
            throw error;
        }
    },

    async getComments(listId) {
        try {
            const { data, error } = await supabase
                .from("list_comments")
                .select('*')
                .eq("listId", listId)
                .order("createdAt", { ascending: false });

            if (error) {
                console.error("Error getting list comments:", error);
                return [];
            }

            return (data || []).map((d) => ({
                ...d,
                createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            }));
        } catch (error) {
            console.error("Error getting list comments:", error);
            return [];
        }
    },

    async deleteComment(commentId, userId) {
        try {
            // Verify ownership first
            const { data: comment, error: fetchError } = await supabase
                .from("list_comments")
                .select('userId')
                .eq('id', commentId)
                .single();

            if (fetchError || !comment || comment.userId !== userId) return false;

            const { error } = await supabase
                .from("list_comments")
                .delete()
                .eq('id', commentId);

            if (error) {
                console.error("Error deleting list comment:", error);
                return false;
            }

            return true;
        } catch (error) {
            console.error("Error deleting list comment:", error);
            return false;
        }
    },

    // ── Banner ──
    async updateBanner(listId, bannerUrl) {
        try {
            const { error } = await supabase
                .from("user_lists")
                .update({ bannerUrl })
                .eq('id', listId);

            if (error) {
                console.error("Error updating list banner:", error);
                return false;
            }

            return true;
        } catch (error) {
            console.error("Error updating list banner:", error);
            return false;
        }
    },

    // ── Delete List ──
    async deleteList(listId) {
        try {
            // Delete children FIRST to avoid orphaning on partial failure

            // Clean up associated likes
            try {
                await supabase
                    .from("list_likes")
                    .delete()
                    .eq("listId", listId);
            } catch (e) {
                console.warn("Failed to clean up list likes:", e);
            }

            // Clean up associated comments
            try {
                await supabase
                    .from("list_comments")
                    .delete()
                    .eq("listId", listId);
            } catch (e) {
                console.warn("Failed to clean up list comments:", e);
            }

            // Delete the list document LAST
            const { error } = await supabase
                .from("user_lists")
                .delete()
                .eq('id', listId);

            if (error) {
                console.error("Error deleting list:", error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error("Error deleting list:", error);
            throw error;
        }
    },
};
