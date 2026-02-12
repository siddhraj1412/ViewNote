import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";

/**
 * Like/unlike a review. Uses deterministic doc ID to prevent duplicate likes.
 */
export const reviewService = {
    // Like doc ID = `{reviewDocId}_{userId}`
    getLikeId(reviewDocId, userId) {
        return `${reviewDocId}_${userId}`;
    },

    async toggleLike(reviewDocId, user) {
        if (!user) return { liked: false, count: 0 };
        const likeId = this.getLikeId(reviewDocId, user.uid);
        const likeRef = doc(db, "review_likes", likeId);

        try {
            const existing = await getDoc(likeRef);
            if (existing.exists()) {
                await deleteDoc(likeRef);
                const count = await this.getLikeCount(reviewDocId);
                return { liked: false, count };
            } else {
                await setDoc(likeRef, {
                    reviewDocId,
                    userId: user.uid,
                    username: user.username || "",
                    photoURL: user.photoURL || "",
                    createdAt: serverTimestamp(),
                });
                const count = await this.getLikeCount(reviewDocId);
                return { liked: true, count };
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            throw error;
        }
    },

    async getLikeCount(reviewDocId) {
        try {
            const q = query(
                collection(db, "review_likes"),
                where("reviewDocId", "==", reviewDocId)
            );
            const snap = await getDocs(q);
            return snap.size;
        } catch {
            return 0;
        }
    },

    async hasUserLiked(reviewDocId, userId) {
        if (!userId) return false;
        const likeId = this.getLikeId(reviewDocId, userId);
        try {
            const snap = await getDoc(doc(db, "review_likes", likeId));
            return snap.exists();
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
            const ref = await addDoc(collection(db, "review_comments"), {
                reviewDocId,
                userId: user.uid,
                username: user.username || "",
                photoURL: user.photoURL || "",
                displayName: user.displayName || user.username || "",
                text: trimmed,
                createdAt: serverTimestamp(),
            });
            return { id: ref.id, userId: user.uid, username: user.username || "", photoURL: user.photoURL || "", displayName: user.displayName || "", text: trimmed, createdAt: new Date() };
        } catch (error) {
            console.error("Error adding comment:", error);
            throw error;
        }
    },

    async getComments(reviewDocId) {
        try {
            const q = query(
                collection(db, "review_comments"),
                where("reviewDocId", "==", reviewDocId),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            return snap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                };
            });
        } catch (error) {
            console.error("Error fetching comments:", error);
            return [];
        }
    },

    async deleteComment(commentId, userId) {
        if (!userId) return false;
        try {
            const ref = doc(db, "review_comments", commentId);
            const snap = await getDoc(ref);
            if (!snap.exists() || snap.data().userId !== userId) return false;
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error("Error deleting comment:", error);
            return false;
        }
    },
};
