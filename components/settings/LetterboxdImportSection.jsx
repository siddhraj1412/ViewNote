"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileArchive, CheckCircle2, XCircle, AlertTriangle, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { importLetterboxdData, getImportHistory } from "@/services/letterboxdImportService";
import { useAuth } from "@/context/AuthContext";
import { createPortal } from "react-dom";

const PHASE_LABELS = {
    extract: "Extracting ZIP",
    dedup: "Checking duplicates",
    tmdb: "Matching with TMDB",
    import: "Processing data",
    commit: "Saving to database",
};

export default function LetterboxdImportSection() {
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(null);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);
    const [previousImport, setPreviousImport] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Check for previous import
    useEffect(() => {
        if (!user?.uid) return;
        getImportHistory(user.uid).then((data) => {
            if (data) setPreviousImport(data);
        });
    }, [user?.uid]);

    const handleFileSelect = useCallback((selectedFile) => {
        if (!selectedFile) return;
        if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
            setError("Please select a ZIP file exported from Letterboxd");
            return;
        }
        if (selectedFile.size > 50 * 1024 * 1024) {
            setError("File is too large (max 50MB)");
            return;
        }
        setFile(selectedFile);
        setError(null);
        setSummary(null);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files?.[0];
        handleFileSelect(droppedFile);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const handleImport = useCallback(async () => {
        if (!file || !user || importing) return;
        setImporting(true);
        setError(null);
        setSummary(null);
        setProgress({ phase: "extract", current: 0, total: 1, message: "Starting import..." });

        try {
            const result = await importLetterboxdData(file, user, (p) => {
                setProgress(p);
            });
            setSummary(result);
            setFile(null);
            // Refresh import history
            getImportHistory(user.uid).then((data) => {
                if (data) setPreviousImport(data);
            });
        } catch (err) {
            setError(err.message || "Import failed");
        } finally {
            setImporting(false);
            setProgress(null);
        }
    }, [file, user, importing]);

    const progressPercent = progress ? Math.round((progress.current / Math.max(1, progress.total)) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Previous Import Warning */}
            {previousImport && !importing && !summary && (
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-yellow-200/80">
                        <span className="font-medium text-yellow-200">Previous import detected.</span> Re-importing is safe — duplicates are automatically skipped. Only new items will be added.
                    </div>
                </div>
            )}

            {/* Drop Zone */}
            {!importing && !summary && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                        dragOver
                            ? "border-accent bg-accent/10"
                            : file
                                ? "border-green-500/40 bg-green-500/5"
                                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                        className="hidden"
                    />
                    {file ? (
                        <>
                            <FileArchive size={28} className="text-green-400" />
                            <div className="text-center">
                                <p className="text-sm font-medium text-white">{file.name}</p>
                                <p className="text-xs text-textSecondary mt-1">{(file.size / 1024).toFixed(1)} KB · Ready to import</p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Remove
                            </button>
                        </>
                    ) : (
                        <>
                            <Upload size={28} className="text-textSecondary" />
                            <div className="text-center">
                                <p className="text-sm text-white font-medium">Drop your Letterboxd ZIP here</p>
                                <p className="text-xs text-textSecondary mt-1">or click to browse · ZIP files only</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Import Button */}
            {file && !importing && !summary && (
                <button
                    type="button"
                    onClick={handleImport}
                    className="w-full py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/85 transition-colors flex items-center justify-center gap-2"
                >
                    <Upload size={16} />
                    Start Import
                </button>
            )}

            {/* Progress — Full-screen lock modal */}
            {importing && progress && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-secondary rounded-2xl border border-white/10 p-8 max-w-md w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldAlert size={20} className="text-yellow-400" />
                            <p className="text-sm font-medium text-yellow-200">
                                Do not close this tab or navigate away
                            </p>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <Loader2 size={24} className="text-accent animate-spin shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-semibold text-white">
                                    {PHASE_LABELS[progress.phase] || progress.phase}
                                </p>
                                <p className="text-xs text-textSecondary truncate mt-0.5">{progress.message}</p>
                            </div>
                            <span className="text-lg text-accent font-mono font-bold tabular-nums">{progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-textSecondary/60 text-center mt-4">
                            This may take several minutes for large libraries
                        </p>
                    </div>
                </div>,
                document.body
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-red-300">Import failed</p>
                        <p className="text-xs text-red-300/70 mt-1">{error}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setError(null); setFile(null); }}
                        className="ml-auto text-xs text-red-400 hover:text-red-300"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Summary */}
            {summary && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 size={18} />
                        <span className="text-sm font-semibold">Import Complete!</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { label: "Watched", v: summary.watched },
                            { label: "Ratings", v: summary.ratings },
                            { label: "Reviews", v: summary.reviews },
                            { label: "Diary", v: summary.diary },
                            { label: "Likes", v: summary.likes },
                            { label: "Watchlist", v: summary.watchlist },
                        ].filter((s) => s.v && s.v.total > 0).map((s) => (
                            <div key={s.label} className="bg-white/5 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-bold text-white tabular-nums">{s.v.imported}</div>
                                <div className="text-[10px] text-textSecondary uppercase tracking-wider">{s.label}</div>
                                {s.v.skipped > 0 && (
                                    <div className="text-[9px] text-yellow-400/70 mt-0.5">{s.v.skipped} skipped</div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-textSecondary">
                        <span>TMDB matched: {summary.tmdbMatches}</span>
                        {summary.tmdbMisses > 0 && (
                            <span className="text-yellow-400/70">Unmatched: {summary.tmdbMisses}</span>
                        )}
                    </div>

                    {summary.errors.length > 0 && (
                        <details className="text-xs">
                            <summary className="text-yellow-400/70 cursor-pointer hover:text-yellow-300 transition-colors">
                                {summary.errors.length} warning{summary.errors.length !== 1 ? "s" : ""}
                            </summary>
                            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto text-textSecondary">
                                {summary.errors.slice(0, 50).map((e, i) => (
                                    <li key={i} className="truncate">• {e}</li>
                                ))}
                            </ul>
                        </details>
                    )}

                    <button
                        type="button"
                        onClick={() => { setSummary(null); setFile(null); }}
                        className="flex items-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                        <RotateCcw size={12} />
                        Import another file
                    </button>
                </div>
            )}
        </div>
    );
}
