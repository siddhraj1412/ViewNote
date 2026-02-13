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
    updateDoc,
} from "firebase/firestore";

export const listService = {
    // ── Likes ──
    getLikeId(listId, userId) {
        return `${listId}_${userId}`;
    },

    async toggleLike(listId, user) {
        if (!user) return { liked: false, count: 0 };
        const likeId = this.getLikeId(listId, user.uid);
        const likeRef = doc(db, "list_likes", likeId);

        try {
            const existing = await getDoc(likeRef);
            if (existing.exists()) {
                await deleteDoc(likeRef);
                const count = await this.getLikeCount(listId);
                return { liked: false, count };
            } else {
                await setDoc(likeRef, {
                    listId,
                    userId: user.uid,
                    username: user.username || "",
                    photoURL: user.photoURL || "",
                    createdAt: serverTimestamp(),
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
            const q = query(collection(db, "list_likes"), where("listId", "==", listId));
            const snap = await getDocs(q);
            return snap.size;
        } catch {
            return 0;
        }
    },

    async hasUserLiked(listId, userId) {
        if (!userId) return false;
        try {
            const snap = await getDoc(doc(db, "list_likes", this.getLikeId(listId, userId)));
            return snap.exists();
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
            const ref = await addDoc(collection(db, "list_comments"), {
                listId,
                userId: user.uid,
                username: user.username || "",
                photoURL: user.photoURL || "",
                displayName: user.displayName || user.username || "",
                text: trimmed,
                createdAt: serverTimestamp(),
            });
            return {
                id: ref.id,
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
            const q = query(
                collection(db, "list_comments"),
                where("listId", "==", listId),
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
            // Fallback if composite index not yet deployed
            if (error?.code === "failed-precondition") {
                const q2 = query(collection(db, "list_comments"), where("listId", "==", listId));
                const snap = await getDocs(q2);
                return snap.docs
                    .map((d) => {
                        const data = d.data();
                        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() };
                    })
                    .sort((a, b) => b.createdAt - a.createdAt);
            }
            console.error("Error getting list comments:", error);
            return [];
        }
    },

    async deleteComment(commentId, userId) {
        try {
            const commentRef = doc(db, "list_comments", commentId);
            const snap = await getDoc(commentRef);
            if (!snap.exists() || snap.data().userId !== userId) return false;
            await deleteDoc(commentRef);
            return true;
        } catch (error) {
            console.error("Error deleting list comment:", error);
            return false;
        }
    },

    // ── Banner ──
    async updateBanner(listId, bannerUrl) {
        try {
            await updateDoc(doc(db, "user_lists", listId), { bannerUrl });
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
                const likesQ = query(collection(db, "list_likes"), where("listId", "==", listId));
                const likesSnap = await getDocs(likesQ);
                const likeDeletes = likesSnap.docs.map((d) => deleteDoc(d.ref));
                await Promise.all(likeDeletes);
            } catch (e) {
                console.warn("Failed to clean up list likes:", e);
            }

            // Clean up associated comments
            try {
                const commentsQ = query(collection(db, "list_comments"), where("listId", "==", listId));
                const commentsSnap = await getDocs(commentsQ);
                const commentDeletes = commentsSnap.docs.map((d) => deleteDoc(d.ref));
                await Promise.all(commentDeletes);
            } catch (e) {
                console.warn("Failed to clean up list comments:", e);
            }

            // Delete the list document LAST
            await deleteDoc(doc(db, "user_lists", listId));

            return true;
        } catch (error) {
            console.error("Error deleting list:", error);
            throw error;
        }
    },
};
