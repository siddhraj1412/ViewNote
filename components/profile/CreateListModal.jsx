"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Search, Loader2, GripVertical, ChevronRight, ChevronDown, Plus, Film, Tv, Clapperboard, Layers, Trash2 } from "lucide-react";
import supabase from "@/lib/supabase";
import showToast from "@/lib/toast";
import { listService } from "@/services/listService";

const LIST_TYPES = [
    { value: "movie", label: "Movie", icon: "🎬" },
    { value: "tv", label: "Series", icon: "📺" },
    { value: "hybrid", label: "Hybrid", icon: "📦" },
];

const TMDB_IMG = "https://image.tmdb.org/t/p";

const NAME_MAX = 80;
const DESC_MAX = 500;

export default function CreateListModal({ isOpen, onClose, userId, onCreated, editList }) {
    const isEdit = !!editList;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [ranked, setRanked] = useState(false);
    const [items, setItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [listType, setListType] = useState("hybrid");
    const [searchFilter, setSearchFilter] = useState("multi");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);

    // Series drill-down state
    const [expandedSeries, setExpandedSeries] = useState(null); // { id, name, poster_path }
    const [seasons, setSeasons] = useState([]);
    const [loadingSeasons, setLoadingSeasons] = useState(false);
    const [expandedSeason, setExpandedSeason] = useState(null); // season_number
    const [episodes, setEpisodes] = useState({}); // { [season_number]: [...eps] }
    const [loadingEpisodes, setLoadingEpisodes] = useState(null);

    // Drag state
    const [dragIdx, setDragIdx] = useState(null);
    const [overIdx, setOverIdx] = useState(null);

    const searchTimer = useRef(null);
    const cache = useRef({});
    const abortRef = useRef(null);
    const searchInputRef = useRef(null);

    // Reset on open/close
    useEffect(() => {
        if (!isOpen) {
            setName(""); setDescription(""); setRanked(false); setItems([]);
            setSearchQuery(""); setSearchResults([]); setSearchFilter("multi"); setListType("hybrid");
            setExpandedSeries(null); setSeasons([]); setExpandedSeason(null); setEpisodes({});
            setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleting(false);
        } else if (editList) {
            setName(editList.name || "");
            setDescription(editList.description || "");
            setRanked(editList.ranked || false);
            setListType(editList.listType || "hybrid");
            setItems((editList.items || []).map((item) => ({
                id: item.id,
                title: item.title || "",
                poster_path: item.poster_path || "",
                mediaType: item.mediaType || item.type || "movie",
                seriesId: item.seriesId || null,
                seasonNumber: item.seasonNumber ?? null,
                episodeNumber: item.episodeNumber ?? null,
            })));
        }
    }, [isOpen, editList]);

    // ── Search with AbortController + 250ms debounce ──
    const searchMedia = useCallback(async (q) => {
        if (!q.trim()) { setSearchResults([]); return; }
        const cacheKey = `${searchFilter}_${q.trim().toLowerCase()}`;
        if (cache.current[cacheKey]) { setSearchResults(cache.current[cacheKey]); return; }

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // Short films search as "movie" on API, filter client-side by runtime
        const apiType = searchFilter === "short" ? "movie" : searchFilter;

        setSearching(true);
        try {
            const res = await fetch(
                `/api/search?query=${encodeURIComponent(q)}&type=${apiType}`,
                { signal: controller.signal }
            );
            const data = await res.json();
            let results = (data.results || []).slice(0, 20);
            // filter client-side for multi
            if (searchFilter === "multi") {
                results = results.filter(r => r.media_type === "movie" || r.media_type === "tv");
            }
            // For short films: keep only movies with runtime ≤ 40 min (use genre_ids heuristic — id 99 = documentary short circuit)
            // Short films typically have no runtime in search, so we tag them and let users decide
            if (searchFilter === "short") {
                results = results.map(r => ({ ...r, media_type: "movie", _isShort: true }));
            }
            cache.current[cacheKey] = results;
            setSearchResults(results);
        } catch (e) {
            if (e.name !== "AbortError") setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, [searchFilter]);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        searchTimer.current = setTimeout(() => searchMedia(searchQuery), 250);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [searchQuery, searchMedia]);

    // Clear drill-down when search filter changes
    useEffect(() => {
        setExpandedSeries(null); setSeasons([]); setExpandedSeason(null); setEpisodes({});
    }, [searchFilter]);

    // Sync search filter when listType changes
    useEffect(() => {
        if (listType === "movie") setSearchFilter("movie");
        else if (listType === "tv") setSearchFilter("tv");
        else setSearchFilter("multi"); // hybrid
        setSearchQuery(""); setSearchResults([]);
    }, [listType]);

    // ── Series → Season → Episode fetching ──
    const fetchSeasons = async (seriesId) => {
        const ck = `seasons_${seriesId}`;
        if (cache.current[ck]) { setSeasons(cache.current[ck]); return; }
        setLoadingSeasons(true);
        try {
            const res = await fetch(`/api/search?tvId=${seriesId}&detail=seasons`);
            const data = await res.json();
            const s = (data.seasons || []).filter(s => s.season_number > 0);
            cache.current[ck] = s;
            setSeasons(s);
        } catch { setSeasons([]); }
        finally { setLoadingSeasons(false); }
    };

    const fetchEpisodes = async (seriesId, seasonNum) => {
        const ck = `eps_${seriesId}_${seasonNum}`;
        if (cache.current[ck]) {
            setEpisodes(prev => ({ ...prev, [seasonNum]: cache.current[ck] }));
            return;
        }
        setLoadingEpisodes(seasonNum);
        try {
            const res = await fetch(`/api/search?tvId=${seriesId}&season=${seasonNum}&detail=episodes`);
            const data = await res.json();
            const eps = data.episodes || [];
            cache.current[ck] = eps;
            setEpisodes(prev => ({ ...prev, [seasonNum]: eps }));
        } catch { /* ignore */ }
        finally { setLoadingEpisodes(null); }
    };

    const handleSeriesClick = (series) => {
        if (expandedSeries?.id === series.id) {
            setExpandedSeries(null); setSeasons([]); setExpandedSeason(null); setEpisodes({});
        } else {
            setExpandedSeries({ id: series.id, name: series.name || series.title, poster_path: series.poster_path });
            setExpandedSeason(null); setEpisodes({});
            fetchSeasons(series.id);
        }
    };

    const handleSeasonClick = (seasonNum) => {
        if (expandedSeason === seasonNum) { setExpandedSeason(null); return; }
        setExpandedSeason(seasonNum);
        if (!episodes[seasonNum]) fetchEpisodes(expandedSeries.id, seasonNum);
    };

    // ── Add helpers ──
    const makeItemKey = (item) => `${item.mediaType}_${item.id}_${item.seasonNumber ?? ""}_${item.episodeNumber ?? ""}`;

    const isAlreadyAdded = (item) => items.some(i => makeItemKey(i) === makeItemKey(item));

    const addItem = (item) => {
        if (isAlreadyAdded(item)) return;
        setItems(prev => [...prev, item]);
    };

    const addMovie = (r) => {
        addItem({
            id: r.id,
            title: r.title || r.name || "",
            poster_path: r.poster_path || "",
            mediaType: r.media_type || (searchFilter === "tv" ? "tv" : "movie"),
        });
        clearSearch();
    };

    const addSeries = (series) => {
        addItem({
            id: series.id,
            title: series.name || series.title || "",
            poster_path: series.poster_path || "",
            mediaType: "tv",
        });
        clearSearch();
    };

    const addSeason = (season) => {
        addItem({
            id: `${expandedSeries.id}_s${season.season_number}`,
            title: `${expandedSeries.name} - Season ${season.season_number}`,
            poster_path: season.poster_path || expandedSeries.poster_path || "",
            mediaType: "season",
            seriesId: expandedSeries.id,
            seasonNumber: season.season_number,
        });
    };

    const addEpisode = (ep, seasonNum) => {
        addItem({
            id: `${expandedSeries.id}_s${seasonNum}e${ep.episode_number}`,
            title: `${expandedSeries.name} - S${seasonNum}E${ep.episode_number}: ${ep.name || ""}`,
            poster_path: ep.still_path || expandedSeries.poster_path || "",
            mediaType: "episode",
            seriesId: expandedSeries.id,
            seasonNumber: seasonNum,
            episodeNumber: ep.episode_number,
        });
        clearSearch();
    };

    const removeItem = (key) => {
        setItems(prev => prev.filter(i => makeItemKey(i) !== key));
    };

    const clearSearch = () => {
        setSearchQuery(""); setSearchResults([]);
        setExpandedSeries(null); setSeasons([]); setExpandedSeason(null); setEpisodes({});
        searchInputRef.current?.focus();
    };

    // ── Drag & drop ──
    const handleDragStart = (idx) => setDragIdx(idx);
    const handleDragOver = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
    const handleDragEnd = () => {
        if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
            setItems(prev => {
                const copy = [...prev];
                const [moved] = copy.splice(dragIdx, 1);
                copy.splice(overIdx, 0, moved);
                return copy;
            });
        }
        setDragIdx(null); setOverIdx(null);
    };

    // ── Delete ──
    const handleDelete = async () => {
        if (!editList?.id || deleteConfirmText !== editList.name) return;
        setDeleting(true);
        try {
            await listService.deleteList(editList.id);
            showToast.success("List deleted");
            if (onCreated) onCreated();
            onClose();
        } catch (error) {
            console.error("Error deleting list:", error);
            showToast.error("Failed to delete list");
        } finally {
            setDeleting(false);
        }
    };

    // ── Save ──
    const handleSave = async () => {
        if (!name.trim()) { showToast.error("List name is required"); return; }
        setSaving(true);
        try {
            const payload = {
                userId,
                name: name.trim(),
                description: description.trim(),
                listType,
                ranked,
                items: items.map((item, idx) => ({
                    id: item.id,
                    title: item.title,
                    poster_path: item.poster_path,
                    mediaType: item.mediaType,
                    ...(item.seriesId ? { seriesId: item.seriesId } : {}),
                    ...(item.seasonNumber != null ? { seasonNumber: item.seasonNumber } : {}),
                    ...(item.episodeNumber != null ? { episodeNumber: item.episodeNumber } : {}),
                    ...(ranked ? { rank: idx + 1 } : {}),
                })),
            };

            // Helper: attempt save, retry without optional columns if they don't exist yet
            const attemptSave = async (data) => {
                if (isEdit) {
                    data.updatedAt = new Date().toISOString();
                    const { error } = await supabase
                        .from("user_lists")
                        .update(data)
                        .eq("id", editList.id);
                    return { error, isEdit: true };
                } else {
                    data.createdAt = new Date().toISOString();
                    const { data: newList, error } = await supabase
                        .from("user_lists")
                        .insert(data)
                        .select()
                        .single();
                    return { error, isEdit: false, newList };
                }
            };

            let result = await attemptSave(payload);

            // If columns don't exist yet, retry without listType and ranked
            if (result.error && (result.error.message?.includes("column") || result.error.code === "42703")) {
                const { listType: _lt, ranked: _r, ...fallbackPayload } = payload;
                result = await attemptSave(fallbackPayload);
            }

            if (result.error) throw result.error;

            if (result.isEdit) {
                showToast.success("List updated!");
            } else {
                showToast.linked("List created!", `/list/${result.newList.id}`);
            }
            if (onCreated) onCreated();
            onClose();
        } catch (error) {
            console.error("Error saving list:", error);
            showToast.error(error?.message || "Failed to save list");
        } finally { setSaving(false); }
    };

    if (!isOpen) return null;

    const isSeriesResult = (r) => (r.media_type === "tv" || searchFilter === "tv") && searchFilter !== "movie" && searchFilter !== "short";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative bg-[#1A1D24] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                style={{ width: "min(90vw, 1200px)", height: "min(90vh, 800px)" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 shrink-0">
                    <h2 className="text-lg font-bold text-white">{isEdit ? "Edit List" : "Create New List"}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-textSecondary" />
                    </button>
                </div>

                {/* Body — two-column on desktop */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: metadata */}
                    <div className="md:w-[340px] shrink-0 p-6 space-y-4 overflow-y-auto border-b md:border-b-0 md:border-r border-white/5">
                        <div>
                            <label className="block text-sm font-medium text-textSecondary mb-1">Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, NAME_MAX))} placeholder="My Favorite Thrillers" maxLength={NAME_MAX}
                                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all text-sm" />
                            <p className={`text-xs mt-1 text-right ${name.length >= NAME_MAX ? "text-red-400" : "text-textSecondary/50"}`}>{name.length}/{NAME_MAX}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-textSecondary mb-1">Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, DESC_MAX))} placeholder="A curated list of..." rows={2} maxLength={DESC_MAX}
                                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all resize-none text-sm" />
                            <p className={`text-xs mt-1 text-right ${description.length >= DESC_MAX ? "text-red-400" : "text-textSecondary/50"}`}>{description.length}/{DESC_MAX}</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={ranked} onChange={e => setRanked(e.target.checked)} className="w-4 h-4 accent-accent rounded" />
                            <span className="text-sm text-white">Ranked list</span>
                        </label>

                        {/* Type selector */}
                        <div>
                            <label className="block text-sm font-medium text-textSecondary mb-2">Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {LIST_TYPES.map(t => (
                                    <button key={t.value} onClick={() => setListType(t.value)}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${listType === t.value ? "bg-accent text-white ring-1 ring-accent" : "bg-white/5 text-textSecondary hover:bg-white/10"}`}>
                                        <span>{t.icon}</span>
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Items list */}
                        {items.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-textSecondary mb-2">Items ({items.length})</label>
                                <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                                    {items.map((item, idx) => {
                                        const key = makeItemKey(item);
                                        return (
                                            <div
                                                key={key}
                                                draggable
                                                onDragStart={() => handleDragStart(idx)}
                                                onDragOver={(e) => handleDragOver(e, idx)}
                                                onDragEnd={handleDragEnd}
                                                className={`flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all ${
                                                    dragIdx === idx ? "opacity-50 scale-95" : ""
                                                } ${overIdx === idx && dragIdx !== idx ? "border-t-2 border-accent" : ""}`}
                                            >
                                                <GripVertical size={14} className="text-white/20 shrink-0" />
                                                {ranked && <span className="text-accent font-bold text-xs w-5 text-center shrink-0">{idx + 1}</span>}
                                                {item.poster_path ? (
                                                    <img src={`${TMDB_IMG}/w92${item.poster_path}`} alt="" className="w-7 h-10 rounded object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-7 h-10 rounded bg-white/10 shrink-0" />
                                                )}
                                                <span className="text-xs text-white truncate flex-1">{item.title}</span>
                                                <button onClick={() => removeItem(key)} className="p-0.5 hover:bg-red-500/20 rounded transition-colors shrink-0">
                                                    <X size={12} className="text-red-400" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: search + results */}
                    <div className="flex-1 flex flex-col overflow-hidden p-6">
                        {/* Filter tabs — only for hybrid type */}
                        {listType === "hybrid" && (
                            <div className="flex gap-2 mb-3 shrink-0">
                                {[{ value: "multi", label: "All" }, { value: "movie", label: "Movies" }, { value: "tv", label: "Series" }].map(f => (
                                    <button key={f.value} onClick={() => { setSearchFilter(f.value); setSearchQuery(""); setSearchResults([]); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            searchFilter === f.value ? "bg-accent text-white" : "bg-white/5 text-textSecondary hover:bg-white/10"
                                        }`}>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Search input */}
                        <div className="relative shrink-0 mb-3">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
                            <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search movies, series, episodes..."
                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all text-sm" />
                            {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-textSecondary" />}
                        </div>

                        {/* Results area */}
                        <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-background/50">
                            {/* Series drill-down view */}
                            {expandedSeries && (
                                <div className="border-b border-white/5">
                                    <button onClick={() => { setExpandedSeries(null); setSeasons([]); setExpandedSeason(null); setEpisodes({}); }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-accent hover:bg-white/5 transition-colors">
                                        ← Back to results
                                    </button>
                                    <div className="px-4 py-2 border-b border-white/5 flex items-center gap-3">
                                        {expandedSeries.poster_path ? (
                                            <img src={`${TMDB_IMG}/w92${expandedSeries.poster_path}`} alt="" className="w-8 h-12 rounded object-cover shrink-0" />
                                        ) : <div className="w-8 h-12 rounded bg-white/10 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{expandedSeries.name}</p>
                                            <p className="text-xs text-textSecondary">Select seasons or episodes to add</p>
                                        </div>
                                        <button onClick={() => addSeries(expandedSeries)}
                                            disabled={isAlreadyAdded({ id: expandedSeries.id, mediaType: "tv" })}
                                            className="px-2 py-1 text-xs bg-accent/20 text-accent rounded-lg hover:bg-accent/30 disabled:opacity-30 shrink-0 transition-colors">
                                            + Series
                                        </button>
                                    </div>

                                    {loadingSeasons ? (
                                        <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-textSecondary" /></div>
                                    ) : (
                                        <div className="divide-y divide-white/5">
                                            {seasons.map(s => (
                                                <div key={s.season_number}>
                                                    <div className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors">
                                                        <button onClick={() => handleSeasonClick(s.season_number)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                                            {expandedSeason === s.season_number ? <ChevronDown size={14} className="text-textSecondary shrink-0" /> : <ChevronRight size={14} className="text-textSecondary shrink-0" />}
                                                            <span className="text-sm text-white truncate">Season {s.season_number}</span>
                                                            <span className="text-xs text-textSecondary shrink-0">{s.episode_count || "?"} eps</span>
                                                        </button>
                                                        <button onClick={() => addSeason(s)}
                                                            disabled={isAlreadyAdded({ id: `${expandedSeries.id}_s${s.season_number}`, mediaType: "season" })}
                                                            className="px-2 py-0.5 text-xs bg-white/5 text-textSecondary rounded hover:bg-white/10 disabled:opacity-30 shrink-0 transition-colors">
                                                            + Season
                                                        </button>
                                                    </div>

                                                    {expandedSeason === s.season_number && (
                                                        <div className="pl-8 bg-white/[0.02]">
                                                            {loadingEpisodes === s.season_number ? (
                                                                <div className="flex items-center py-4 px-4"><Loader2 size={14} className="animate-spin text-textSecondary mr-2" /><span className="text-xs text-textSecondary">Loading episodes...</span></div>
                                                            ) : (episodes[s.season_number] || []).map(ep => {
                                                                const epItem = { id: `${expandedSeries.id}_s${s.season_number}e${ep.episode_number}`, mediaType: "episode" };
                                                                return (
                                                                    <div key={ep.episode_number} className="flex items-center gap-2 px-4 py-1.5 hover:bg-white/5 transition-colors">
                                                                        <span className="text-xs text-textSecondary w-10 shrink-0">E{ep.episode_number}</span>
                                                                        <span className="text-xs text-white truncate flex-1">{ep.name || `Episode ${ep.episode_number}`}</span>
                                                                        <button onClick={() => addEpisode(ep, s.season_number)} disabled={isAlreadyAdded(epItem)}
                                                                            className="p-0.5 text-accent hover:bg-accent/20 rounded disabled:opacity-30 shrink-0 transition-colors">
                                                                            <Plus size={14} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Search results */}
                            {!expandedSeries && searchResults.length > 0 && (
                                <div className="divide-y divide-white/5">
                                    {searchResults.map(r => {
                                        const isTv = isSeriesResult(r);
                                        return (
                                            <div key={`${r.media_type || searchFilter}_${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                                                {r.poster_path ? (
                                                    <img src={`${TMDB_IMG}/w154${r.poster_path}`} alt="" className="w-[60px] h-[90px] rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-[60px] h-[90px] rounded-lg bg-white/10 shrink-0 flex items-center justify-center">
                                                        {isTv ? <Tv size={20} className="text-white/20" /> : <Film size={20} className="text-white/20" />}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[15px] font-medium text-white line-clamp-2 leading-snug">{r.title || r.name}</p>
                                                    <p className="text-xs text-textSecondary mt-1">{isTv ? "Series" : r._isShort ? "Short Film" : "Movie"}{r.release_date || r.first_air_date ? ` · ${(r.release_date || r.first_air_date || "").slice(0, 4)}` : ""}{r.vote_average ? ` · ★ ${r.vote_average.toFixed(1)}` : ""}</p>
                                                </div>
                                                {isTv && (
                                                    <button onClick={() => handleSeriesClick(r)}
                                                        className="px-2.5 py-1.5 text-xs bg-white/5 text-textSecondary rounded-lg hover:bg-white/10 shrink-0 transition-colors font-medium">
                                                        Seasons ›
                                                    </button>
                                                )}
                                                <button onClick={() => isTv ? addSeries(r) : addMovie(r)}
                                                    disabled={isAlreadyAdded({ id: r.id, mediaType: isTv ? "tv" : "movie" })}
                                                    className="p-2 text-accent hover:bg-accent/20 rounded-lg disabled:opacity-30 shrink-0 transition-colors">
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Empty state */}
                            {!expandedSeries && searchResults.length === 0 && !searching && (
                                <div className="flex flex-col items-center justify-center h-full text-textSecondary py-12">
                                    <Search size={32} className="mb-3 opacity-30" />
                                    <p className="text-sm">Search for movies, series, or episodes to add</p>
                                </div>
                            )}

                            {searching && searchResults.length === 0 && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-textSecondary" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-white/5 shrink-0">
                    {/* Delete confirmation inline */}
                    {isEdit && showDeleteConfirm && (
                        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-xs text-red-400 mb-2">
                                Type <strong>"{editList.name}"</strong> to confirm deletion. This cannot be undone.
                            </p>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder="Type list name to confirm"
                                className="w-full px-3 py-2 bg-background border border-red-500/30 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-red-500/60 mb-2"
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                                    className="px-3 py-1.5 text-xs text-textSecondary hover:text-white transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDelete}
                                    disabled={deleteConfirmText !== editList.name || deleting}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        deleteConfirmText === editList.name && !deleting
                                            ? "bg-red-500 text-white hover:bg-red-600"
                                            : "bg-white/5 text-white/20 cursor-not-allowed"
                                    }`}>
                                    {deleting ? "Deleting..." : "Delete Forever"}
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-textSecondary">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                            {isEdit && !showDeleteConfirm && (
                                <button onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all">
                                    <Trash2 size={13} />
                                    Delete List
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} disabled={saving || deleting} className="px-4 py-2 text-sm text-textSecondary hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={!name.trim() || saving || deleting}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${!name.trim() || saving || deleting ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20"}`}>
                                {saving ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create List")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
