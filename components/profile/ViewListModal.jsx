"use client";

import { useState } from "react";
import { X, Edit2, Trash2, Crown } from "lucide-react";
import supabase from "@/lib/supabase";
import { detectListType, getListTypeInfo } from "@/lib/listUtils";
import showToast from "@/lib/toast";
import Link from "next/link";

export default function ViewListModal({ isOpen, onClose, list, isOwnProfile, onEdit, onDeleted }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    if (!isOpen || !list) return null;

    const listType = detectListType(list.items);
    const { Icon: TypeIcon, label: typeLabel, color: typeColor } = getListTypeInfo(listType);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const { error } = await supabase.from("user_lists").delete().eq("id", list.id);
            if (error) throw error;
            showToast.success("List deleted");
            if (onDeleted) onDeleted();
            onClose();
        } catch (error) {
            console.error("Error deleting list:", error);
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#1A1D24] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                style={{ width: "min(90vw, 600px)", maxHeight: "min(90vh, 700px)" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 shrink-0">
                    <div className="flex-1 min-w-0 mr-3">
                        <h2 className="text-lg font-bold text-white truncate">{list.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-textSecondary">
                            <span className={`flex items-center gap-1 ${typeColor}`}><TypeIcon size={10} /> {typeLabel}</span>
                            <span>·</span>
                            <span>{(list.items || []).length} items</span>
                            {list.ranked && (
                                <>
                                    <span>·</span>
                                    <span className="flex items-center gap-1"><Crown size={10} /> Ranked</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {isOwnProfile && (
                            <>
                                <button onClick={() => { onClose(); if (onEdit) onEdit(list); }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Edit list">
                                    <Edit2 size={16} className="text-textSecondary" />
                                </button>
                                <button onClick={() => setConfirmDelete(true)}
                                    className="p-2 hover:bg-red-500/20 rounded-full transition-colors" title="Delete list">
                                    <Trash2 size={16} className="text-red-400" />
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} className="text-textSecondary" />
                        </button>
                    </div>
                </div>

                {/* Description */}
                {list.description && (
                    <div className="px-6 py-3 border-b border-white/5">
                        <p className="text-sm text-textSecondary">{list.description}</p>
                    </div>
                )}

                {/* Delete confirmation */}
                {confirmDelete && (
                    <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between shrink-0">
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

                {/* Items — poster + title only */}
                <div className="flex-1 overflow-y-auto">
                    {(list.items || []).length === 0 ? (
                        <div className="text-center py-12 text-textSecondary"><p>This list is empty</p></div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {list.items.map((item, idx) => (
                                <Link key={`${item.id}_${idx}`} href={getMediaLink(item)}
                                    className="flex items-center gap-3 px-6 py-3 hover:bg-white/5 transition-colors">
                                    {list.ranked && (
                                        <span className="text-accent font-bold text-sm w-6 text-center flex-shrink-0">{idx + 1}</span>
                                    )}
                                    {item.poster_path ? (
                                        <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt={item.title}
                                            className="w-10 h-14 rounded object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-14 rounded bg-white/10 flex-shrink-0" />
                                    )}
                                    <span className="text-sm text-white truncate flex-1">{item.title}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
