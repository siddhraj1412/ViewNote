"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { detectListType, getListTypeInfo } from "@/lib/listUtils";
import { Crown, ArrowLeft, Grid3X3, List, Heart, MessageCircle, Send, Loader2 } from "lucide-react";
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
    const [viewMode, setViewMode] = useState("grid");
    const [ownerProfile, setOwnerProfile] = useState(null);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [sendingComment, setSendingComment] = useState(false);
    const [showComments, setShowComments] = useState(false);

    useEffect(() => {
        if (!listId) return;
        const fetchList = async () => {
            setLoading(true);
            try {
                const { data: listData } = await supabase
                    .from("user_lists")
                    .select("*")
                    .eq("id", listId)
                    .single();
                if (listData) {
                    setList(listData);
                    if (listData.userId) {
                        const { data: profileData } = await supabase
                            .from("profiles")
                            .select("*")
                            .eq("id", listData.userId)
                            .single();
                        if (profileData) setOwnerProfile(profileData);
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

    const getMediaLink = (item) => {
        const type = item.mediaType || "movie";
        if (type === "episode" || type === "season") return item.seriesId ? `/tv/${item.seriesId}` : "#";
        if (type === "tv") return `/tv/${item.id}`;
        return `/movie/${item.id}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <Loader2 size={24} className="animate-spin text-textSecondary" />
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
            <div className="container pt-24 pb-16">
                {/* Back button */}
                <button onClick={() => router.back()}
                    className="mb-4 text-sm text-textSecondary hover:text-white transition-colors flex items-center gap-1.5">
                    <ArrowLeft size={14} />
                    Back
                </button>

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
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
                    </div>
                </div>

                {/* Social: Like & Comments toggle */}
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

                {/* Comments section (below items) */}
                {showComments && (
                    <div className="mt-8 border border-white/5 rounded-xl p-4 bg-white/[0.02]">
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
            </div>
        </main>
    );
}
