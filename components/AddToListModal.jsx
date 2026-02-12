"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Check, Loader2, List } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, addDoc, serverTimestamp } from "firebase/firestore";
import showToast from "@/lib/toast";

const NAME_MAX = 80;

export default function AddToListModal({ isOpen, onClose, userId, mediaId, mediaType, title, posterPath }) {
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addingTo, setAddingTo] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [creating, setCreating] = useState(false);

    const fetchLists = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const q = query(collection(db, "user_lists"), where("userId", "==", userId));
            const snap = await getDocs(q);
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setLists(data);
        } catch (error) {
            console.error("Error loading lists:", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (isOpen) {
            fetchLists();
            setShowCreate(false);
            setNewListName("");
        }
    }, [isOpen, fetchLists]);

    if (!isOpen) return null;

    const isInList = (list) => {
        return (list.items || []).some(item =>
            String(item.id) === String(mediaId) && (item.mediaType || "movie") === mediaType
        );
    };

    const handleAddToList = async (list) => {
        if (isInList(list)) {
            showToast.info("Already in this list");
            return;
        }
        setAddingTo(list.id);
        try {
            const newItem = {
                id: mediaId,
                title: title || "",
                poster_path: posterPath || "",
                mediaType: mediaType || "movie",
            };
            const listRef = doc(db, "user_lists", list.id);
            const updatedItems = [...(list.items || []), newItem];
            await updateDoc(listRef, {
                items: updatedItems,
                updatedAt: serverTimestamp(),
            });
            // Update local state
            setLists(prev => prev.map(l =>
                l.id === list.id ? { ...l, items: updatedItems } : l
            ));
            showToast.success(`Added to "${list.name}"`);
        } catch (error) {
            console.error("Error adding to list:", error);
            showToast.error("Failed to add to list");
        } finally {
            setAddingTo(null);
        }
    };

    const handleCreateAndAdd = async () => {
        if (!newListName.trim()) return;
        setCreating(true);
        try {
            const newItem = {
                id: mediaId,
                title: title || "",
                poster_path: posterPath || "",
                mediaType: mediaType || "movie",
            };
            const payload = {
                userId,
                name: newListName.trim(),
                description: "",
                ranked: false,
                items: [newItem],
                createdAt: serverTimestamp(),
            };
            const docRef = await addDoc(collection(db, "user_lists"), payload);
            setLists(prev => [{ id: docRef.id, ...payload, items: [newItem] }, ...prev]);
            showToast.success(`Created "${newListName.trim()}" and added`);
            setShowCreate(false);
            setNewListName("");
        } catch (error) {
            console.error("Error creating list:", error);
            showToast.error("Failed to create list");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#1A1D24] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                style={{ width: "min(90vw, 440px)", maxHeight: "min(85vh, 560px)" }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5 shrink-0">
                    <h2 className="text-base font-bold text-white">Add to List</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                        <X size={18} className="text-textSecondary" />
                    </button>
                </div>

                {/* Media preview */}
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3 shrink-0">
                    {posterPath ? (
                        <img src={`https://image.tmdb.org/t/p/w92${posterPath}`} alt="" className="w-10 h-[60px] rounded-lg object-cover shrink-0" />
                    ) : (
                        <div className="w-10 h-[60px] rounded-lg bg-white/10 shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{title}</p>
                        <p className="text-xs text-textSecondary mt-0.5 capitalize">{mediaType === "tv" ? "Series" : "Movie"}</p>
                    </div>
                </div>

                {/* Lists */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-textSecondary" />
                        </div>
                    ) : lists.length === 0 && !showCreate ? (
                        <div className="flex flex-col items-center justify-center py-12 text-textSecondary">
                            <List size={32} className="mb-3 opacity-30" />
                            <p className="text-sm mb-3">No lists yet</p>
                            <button onClick={() => setShowCreate(true)}
                                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-all inline-flex items-center gap-1.5">
                                <Plus size={14} />
                                Create List
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {lists.map(list => {
                                const already = isInList(list);
                                const isAdding = addingTo === list.id;
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleAddToList(list)}
                                        disabled={already || isAdding}
                                        className={`w-full px-5 py-3 text-left hover:bg-white/5 transition-all flex items-center gap-3 ${already ? "opacity-60" : ""}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{list.name}</p>
                                            <p className="text-xs text-textSecondary">{(list.items || []).length} items{list.ranked ? " · Ranked" : ""}</p>
                                        </div>
                                        {isAdding ? (
                                            <Loader2 size={16} className="animate-spin text-accent shrink-0" />
                                        ) : already ? (
                                            <Check size={16} className="text-green-400 shrink-0" />
                                        ) : (
                                            <Plus size={16} className="text-accent shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Create new list inline */}
                <div className="p-4 border-t border-white/5 bg-white/5 shrink-0">
                    {showCreate ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newListName}
                                onChange={e => setNewListName(e.target.value.slice(0, NAME_MAX))}
                                placeholder="New list name..."
                                maxLength={NAME_MAX}
                                autoFocus
                                onKeyDown={e => { if (e.key === "Enter" && newListName.trim()) handleCreateAndAdd(); }}
                                className="flex-1 px-3 py-2 bg-background border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all text-sm"
                            />
                            <button
                                onClick={handleCreateAndAdd}
                                disabled={!newListName.trim() || creating}
                                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold hover:bg-accent/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                            >
                                {creating ? <Loader2 size={14} className="animate-spin" /> : "Create"}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full px-4 py-2 text-sm text-accent font-medium hover:bg-white/5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                            <Plus size={14} />
                            Create New List
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
