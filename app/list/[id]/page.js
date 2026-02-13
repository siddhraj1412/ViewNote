"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { detectListType, getListTypeInfo } from "@/lib/listUtils";
import { Crown, ArrowLeft, Grid3X3, List, Edit2, Trash2, Heart, MessageCircle, Send, Image as ImageIcon } from "lucide-react";
import { deleteDoc } from "firebase/firestore";
import showToast from "@/lib/toast";
import { listService } from "@/services/listService";

const TMDB_IMG = "https://image.tmdb.org/t/p";

export default function ListPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const listId = params.id;

    const [list, setList] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState("grid"); // grid | list
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [ownerProfile, setOwnerProfile] = useState(null);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [sendingComment, setSendingComment] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const bannerInputRef = useRef(null);

    useEffect(() => {
        if (!listId) return;
        const fetchList = async () => {
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, "user_lists", listId));
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() };
                    setList(data);
                    // Fetch owner profile
                    if (data.userId) {
                        const profileSnap = await getDoc(doc(db, "user_profiles", data.userId));
                        if (profileSnap.exists()) setOwnerProfile(profileSnap.data());
                    }
                }
            } catch (error) {
                console.error("Error loading list:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchList();
    }, [listId]);

    // Load likes & comments
    useEffect(() => {
        if (!listId) return;
        listService.getLikeState(listId, user?.uid).then(({ liked, count }) => {
            setLiked(liked);
            setLikeCount(count);
        });
        listService.getComments(listId).then(setComments);
    }, [listId, user?.uid]);

    const handleLike = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        try {
            const result = await listService.toggleLike(listId, user);
            setLiked(result.liked);
            setLikeCount(result.count);
        } catch { showToast.error("Failed to like"); }
    };

    const handleComment = async () => {
        if (!user) { showToast.info("Please sign in"); return; }
        if (!commentText.trim()) return;
        setSendingComment(true);
        try {
            const c = await listService.addComment(listId, user, commentText);
            if (c) { setComments(prev => [c, ...prev]); setCommentText(""); }
        } catch { showToast.error("Failed to comment"); }
        setSendingComment(false);
    };

    const handleDeleteComment = async (commentId) => {
        const ok = await listService.deleteComment(commentId);
        if (ok) setComments(prev => prev.filter(c => c.id !== commentId));
    };

    const handleBannerUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setUploadingBanner(true);
        try {
            const storageRef = ref(storage, `lists/${user.uid}/${listId}/banner`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await listService.updateBanner(listId, url);
            setList(prev => ({ ...prev, bannerUrl: url }));
            showToast.success("Banner updated");
        } catch (err) {
            console.error(err);
            showToast.error("Failed to upload banner");
        }
        setUploadingBanner(false);
        if (bannerInputRef.current) bannerInputRef.current.value = "";
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "user_lists", listId));
            showToast.success("List deleted");
            router.back();
        } catch (error) {
            showToast.error("Failed to delete list");
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const getMediaLink = (item) => {
        const type = item.mediaType || "movie";
        if (type === "episode" || type === "season") return item.seriesId ? `/tv/${item.seriesId}` : "#";
        if (type === "tv") return `/tv/${item.id}`;
        return `/movie/${item.id}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!list) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">List not found</h1>
                    <p className="text-textSecondary">This list does not exist or has been deleted.</p>
                </div>
            </div>
        );
    }

    const isOwner = user?.uid === list.userId;
    const listType = detectListType(list.items);
    const { Icon: TypeIcon, label: typeLabel, color: typeColor } = getListTypeInfo(listType);
    const items = list.items || [];
    const ownerName = ownerProfile?.username || ownerProfile?.display_name || "";

    return (
        <main className="min-h-screen bg-background">
            {/* Banner */}
            {(list.bannerUrl || (items.length > 0 && items[0].poster_path)) && (
                <div className="relative h-[35vh] md:h-[40vh] overflow-hidden">
                    <img
                        src={list.bannerUrl || `${TMDB_IMG}/w1280${items[0].poster_path}`}
                        alt=""
                        className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-background" />
                    {isOwner && (
                        <button
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={uploadingBanner}
                            className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white/80 text-xs rounded-lg hover:bg-black/80 transition"
                        >
                            <ImageIcon size={14} />
                            {uploadingBanner ? "Uploading..." : "Change Banner"}
                        </button>
                    )}
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                </div>
            )}

            <div className="container pb-16" style={{ marginTop: (list.bannerUrl || (items.length > 0 && items[0].poster_path)) ? "-80px" : "80px" }}>
                <div className="relative z-10">
                    {/* Back button */}
                    <button onClick={() => router.back()}
                        className="mb-4 text-sm text-textSecondary hover:text-white transition-colors flex items-center gap-1.5">
                        <ArrowLeft size={14} />
                        Back
                    </button>

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <TypeIcon size={20} className={typeColor} />
                                <h1 className="text-3xl md:text-4xl font-bold text-white">{list.name}</h1>
                                {list.ranked && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent text-xs font-bold rounded-full">
                                        <Crown size={10} /> Ranked
                                    </span>
                                )}
                            </div>
                            {list.description && (
                                <p className="text-textSecondary max-w-2xl mt-1">{list.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-3 text-sm text-textSecondary">
                                <span className={typeColor}>{typeLabel}</span>
                                <span>·</span>
                                <span>{items.length} items</span>
                                {ownerName && (
                                    <>
                                        <span>·</span>
                                        <Link href={`/${ownerName}`} className="text-accent hover:underline">@{ownerName}</Link>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* View toggle */}
                            <div className="flex bg-white/5 rounded-lg p-0.5">
                                <button onClick={() => setViewMode("grid")}
                                    className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-accent text-white" : "text-textSecondary hover:text-white"}`}>
                                    <Grid3X3 size={16} />
                                </button>
                                <button onClick={() => setViewMode("list")}
                                    className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-accent text-white" : "text-textSecondary hover:text-white"}`}>
                                    <List size={16} />
                                </button>
                            </div>

                            {isOwner && (
                                <>
                                    <button onClick={() => setConfirmDelete(true)}
                                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete list">
                                        <Trash2 size={16} className="text-red-400" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Delete confirmation */}
                    {confirmDelete && (
                        <div className="mb-6 px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-red-400">Delete this list permanently?</span>
                            <div className="flex gap-2">
                                <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                                    className="px-3 py-1 text-xs text-textSecondary hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleDelete} disabled={deleting}
                                    className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
                                    {deleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Social: Like & Comments */}
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={handleLike} className="flex items-center gap-1.5 text-sm group">
                            <Heart size={18} fill={liked ? "currentColor" : "none"} className={liked ? "text-red-500" : "text-textSecondary group-hover:text-red-400 transition-colors"} />
                            <span className={liked ? "text-red-500" : "text-textSecondary"}>{likeCount || ""}</span>
                        </button>
                        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-textSecondary hover:text-white transition-colors">
                            <MessageCircle size={18} />
                            <span>{comments.length || ""}</span>
                        </button>
                    </div>

                    {showComments && (
                        <div className="mb-8 border border-white/5 rounded-xl p-4 bg-white/[0.02]">
                            <div className="flex gap-2 mb-4">
                                <input
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                                    placeholder="Add a comment..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-textSecondary focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                                <button onClick={handleComment} disabled={sendingComment || !commentText.trim()}
                                    className="px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent/80 transition">
                                    <Send size={16} />
                                </button>
                            </div>
                            {comments.length === 0 ? (
                                <p className="text-sm text-textSecondary text-center py-4">No comments yet</p>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {comments.map((c) => (
                                        <div key={c.id} className="flex gap-3">
                                            <Link href={`/${c.username}`} className="shrink-0">
                                                {c.photoURL ? (
                                                    <img src={c.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                                                        {(c.username || "?")[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </Link>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <Link href={`/${c.username}`} className="text-sm font-medium text-white hover:text-accent transition-colors">
                                                        {c.username || "User"}
                                                    </Link>
                                                    <span className="text-[10px] text-textSecondary">
                                                        {c.createdAt instanceof Date ? c.createdAt.toLocaleDateString() : ""}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-textSecondary break-words">{c.text}</p>
                                            </div>
                                            {user?.uid === c.userId && (
                                                <button onClick={() => handleDeleteComment(c.id)} className="text-textSecondary hover:text-red-400 text-xs shrink-0">✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items */}
                    {items.length === 0 ? (
                        <div className="text-center py-16 text-textSecondary">
                            <p>This list is empty</p>
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {items.map((item, idx) => (
                                <Link key={`${item.id}_${idx}`} href={getMediaLink(item)}
                                    className="group relative">
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary">
                                        {item.poster_path ? (
                                            <img src={`${TMDB_IMG}/w342${item.poster_path}`} alt={item.title}
                                                className="w-full h-full object-cover transition-transform duration-300" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                                <TypeIcon size={32} />
                                            </div>
                                        )}
                                        {list.ranked && (
                                            <span className="absolute top-2 left-2 bg-accent text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                                                {idx + 1}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="mt-2 text-sm text-white font-medium line-clamp-2">{item.title}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden">
                            {items.map((item, idx) => (
                                <Link key={`${item.id}_${idx}`} href={getMediaLink(item)}
                                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors">
                                    {list.ranked && (
                                        <span className="text-accent font-bold text-lg w-8 text-center shrink-0">{idx + 1}</span>
                                    )}
                                    {item.poster_path ? (
                                        <img src={`${TMDB_IMG}/w92${item.poster_path}`} alt={item.title}
                                            className="w-12 h-[72px] rounded-lg object-cover shrink-0" />
                                    ) : (
                                        <div className="w-12 h-[72px] rounded-lg bg-white/10 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">{item.title}</p>
                                        <p className="text-xs text-textSecondary capitalize">{item.mediaType || "movie"}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
