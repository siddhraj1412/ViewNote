import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    runTransaction,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    orderBy,
    serverTimestamp,
    writeBatch,
    increment,
} from "firebase/firestore";
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
        const likeId = this.getLikeId(reviewDocId, user.uid);
        const likeRef = doc(db, "review_likes", likeId);
        const reviewRef = doc(db, "user_ratings", reviewDocId);

        try {
            let wasLiked = false;

            await runTransaction(db, async (tx) => {
                // ---- ALL READS FIRST ----
                const likeSnap = await tx.get(likeRef);
                const reviewSnap = await tx.get(reviewRef);

                // ---- WRITES AFTER READS ----
                if (likeSnap.exists()) {
                    wasLiked = true;
                    tx.delete(likeRef);
                    // Decrement likeCount on the review doc
                    if (reviewSnap.exists()) {
                        const currentCount = Number(reviewSnap.data()?.likeCount || 0);
                        tx.update(reviewRef, { likeCount: Math.max(0, currentCount - 1) });
                    }
                } else {
                    wasLiked = false;
                    tx.set(likeRef, {
                        reviewDocId,
                        userId: user.uid,
                        username: user.username || "",
                        photoURL: user.photoURL || "",
                        createdAt: serverTimestamp(),
                    });
                    // Increment likeCount on the review doc
                    if (reviewSnap.exists()) {
                        const currentCount = Number(reviewSnap.data()?.likeCount || 0);
                        tx.update(reviewRef, { likeCount: currentCount + 1 });
                    }
                }
            });

            const count = await this.getLikeCount(reviewDocId);
            const likedNow = !wasLiked;

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
            // Try ordered query first (requires composite index)
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
            // Fallback: query without orderBy if index is missing
            if (error.code === "failed-precondition") {
                console.warn("[ReviewService] Missing index for review_comments. Using client-side sort.");
                try {
                    const fallbackQ = query(
                        collection(db, "review_comments"),
                        where("reviewDocId", "==", reviewDocId)
                    );
                    const snap = await getDocs(fallbackQ);
                    const results = snap.docs.map((d) => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            createdAt: data.createdAt?.toDate?.() || new Date(),
                        };
                    });
                    return results.sort((a, b) => b.createdAt - a.createdAt);
                } catch (fallbackErr) {
                    console.error("Fallback comment query also failed:", fallbackErr);
                    return [];
                }
            }
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

    async deleteReviewThread(reviewDocId) {
        if (!reviewDocId) return { likesDeleted: 0, commentsDeleted: 0 };
        try {
            const [likesSnap, commentsSnap] = await Promise.all([
                getDocs(query(collection(db, "review_likes"), where("reviewDocId", "==", reviewDocId))),
                getDocs(query(collection(db, "review_comments"), where("reviewDocId", "==", reviewDocId))),
            ]);

            const batch = writeBatch(db);
            likesSnap.docs.forEach((d) => batch.delete(d.ref));
            commentsSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();

            return { likesDeleted: likesSnap.size, commentsDeleted: commentsSnap.size };
        } catch (error) {
            console.error("[ReviewService] deleteReviewThread error:", error);
            return { likesDeleted: 0, commentsDeleted: 0 };
        }
    },
};
