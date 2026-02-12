"use client";

import { useState, useEffect, useCallback } from "react";
import { List, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { detectListType, getListTypeInfo } from "@/lib/listUtils";
import CreateListModal from "./CreateListModal";
import ViewListModal from "./ViewListModal";

export default function ListsSection({ ownerId, isOwnProfile }) {
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editList, setEditList] = useState(null);
    const [viewList, setViewList] = useState(null);

    const fetchLists = useCallback(async () => {
        if (!ownerId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "user_lists"),
                where("userId", "==", ownerId)
            );
            const snap = await getDocs(q);
            const data = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setLists(data);
        } catch (error) {
            console.error("Error loading lists:", error);
        } finally {
            setLoading(false);
        }
    }, [ownerId]);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    const handleOpenCreate = () => {
        setEditList(null);
        setCreateOpen(true);
    };

    const handleEdit = (list) => {
        setEditList(list);
        setCreateOpen(true);
    };

    if (loading) {
        return (
            <section>
                <h2 className="text-3xl font-bold mb-6">Lists</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-secondary rounded-xl p-5 border border-white/5 animate-pulse">
                            <div className="h-5 bg-white/10 rounded w-2/3 mb-3" />
                            <div className="h-3 bg-white/10 rounded w-1/2 mb-4" />
                            <div className="flex gap-2">
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="w-10 h-14 rounded bg-white/10" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (lists.length === 0) {
        return (
            <section>
                <h2 className="text-3xl font-bold mb-6">Lists</h2>
                <div className="text-center py-12">
                    <List size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                    <p className="text-textSecondary mb-4">No custom lists yet</p>
                    {isOwnProfile && (
                        <>
                            <button
                                onClick={handleOpenCreate}
                                className="px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 inline-flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Create New List
                            </button>
                            <CreateListModal
                                isOpen={createOpen}
                                onClose={() => { setCreateOpen(false); setEditList(null); }}
                                userId={ownerId}
                                onCreated={fetchLists}
                                editList={editList}
                            />
                        </>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Lists</h2>
                {isOwnProfile && (
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-all inline-flex items-center gap-1.5"
                    >
                        <Plus size={16} />
                        New List
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lists.map((list) => {
                    const listType = detectListType(list.items);
                    const { Icon: TypeIcon, label: typeLabel, color: typeColor } = getListTypeInfo(listType);
                    return (
                    <button
                        key={list.id}
                        onClick={() => setViewList(list)}
                        className="bg-secondary rounded-xl p-5 border border-white/5 text-left hover:border-white/15 hover:bg-secondary/80 transition-all group"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <TypeIcon size={14} className={typeColor} />
                            <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors truncate">
                                {list.name}
                            </h3>
                        </div>
                        {list.description && (
                            <p className="text-sm text-textSecondary mb-3 line-clamp-2">{list.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-textSecondary">
                            <span className={typeColor}>{typeLabel}</span>
                            <span>·</span>
                            <span>{(list.items || []).length} items</span>
                            {list.ranked && (
                                <>
                                    <span>·</span>
                                    <span>Ranked</span>
                                </>
                            )}
                        </div>
                        {(list.items || []).length > 0 && (
                            <div className="flex gap-2 mt-3 overflow-hidden">
                                {list.items.slice(0, 5).map((item, idx) => (
                                    <div key={item.id || idx} className="relative flex-shrink-0">
                                        {item.poster_path ? (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                                                alt={item.title}
                                                className="w-10 h-14 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-14 rounded bg-white/10" />
                                        )}
                                        {list.ranked && (
                                            <span className="absolute -top-1 -left-1 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {list.items.length > 5 && (
                                    <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center text-xs text-textSecondary flex-shrink-0">
                                        +{list.items.length - 5}
                                    </div>
                                )}
                            </div>
                        )}
                    </button>
                    );
                })}
            </div>

            {/* View detail modal */}
            <ViewListModal
                isOpen={!!viewList}
                onClose={() => setViewList(null)}
                list={viewList}
                isOwnProfile={isOwnProfile}
                onEdit={handleEdit}
                onDeleted={fetchLists}
            />

            {/* Create / Edit modal */}
            <CreateListModal
                isOpen={createOpen}
                onClose={() => { setCreateOpen(false); setEditList(null); }}
                userId={ownerId}
                onCreated={fetchLists}
                editList={editList}
            />
        </section>
    );
}
