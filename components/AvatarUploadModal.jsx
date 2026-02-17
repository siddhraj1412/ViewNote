"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, ZoomIn, ZoomOut, Loader2, RotateCcw } from "lucide-react";
import supabase from "@/lib/supabase";
import showToast from "@/lib/toast";
import eventBus from "@/lib/eventBus";

// ── Render cropped canvas from user position/zoom ──
function renderCroppedCanvas(img, pos, zoom, size = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const minDim = Math.min(img.width, img.height);
    const cropSize = minDim / zoom;
    const maxOffsetX = img.width - cropSize;
    const maxOffsetY = img.height - cropSize;
    const sx = Math.max(0, Math.min(maxOffsetX, (img.width - cropSize) / 2 - pos.x * (img.width / 2)));
    const sy = Math.max(0, Math.min(maxOffsetY, (img.height - cropSize) / 2 - pos.y * (img.height / 2)));

    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);
    return canvas;
}

// ── Compress to webp ≤200KB (falling back to JPEG if webp not supported) ──
function compressCanvas(canvas) {
    return new Promise((resolve, reject) => {
        const tryFormat = (format, q) => {
            try {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            // If webp failed, try jpeg
                            if (format === "image/webp") {
                                tryFormat("image/jpeg", 0.85);
                                return;
                            }
                            reject(new Error("Compression failed"));
                            return;
                        }
                        if (blob.size > 200 * 1024 && q > 0.3) {
                            tryFormat(format, q - 0.1);
                        } else {
                            resolve(blob);
                        }
                    },
                    format,
                    q
                );
            } catch {
                if (format === "image/webp") {
                    tryFormat("image/jpeg", 0.85);
                } else {
                    reject(new Error("Compression failed"));
                }
            }
        };
        tryFormat("image/webp", 0.85);
    });
}

export default function AvatarUploadModal({ isOpen, onClose, userId, currentAvatar, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [imgElement, setImgElement] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);

    // Crop state
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [posStart, setPosStart] = useState({ x: 0, y: 0 });

    const fileInputRef = useRef(null);
    const cropAreaRef = useRef(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setImgElement(null);
            setUploading(false);
            setProgress(0);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const validateFile = (f) => {
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validTypes.includes(f.type)) {
            showToast.error("Invalid file type. Use JPG, PNG, or WEBP.");
            return false;
        }
        if (f.size > 2 * 1024 * 1024) {
            showToast.error("File is too large. Max 2MB.");
            return false;
        }
        return true;
    };

    const loadImage = (f) => {
        if (!validateFile(f)) return;
        const img = new window.Image();
        img.onload = () => {
            if (img.width < 256 || img.height < 256) {
                showToast.error("Image must be at least 256×256 pixels.");
                return;
            }
            if (img.width > 4096 || img.height > 4096) {
                showToast.error("Image must be at most 4096×4096 pixels.");
                return;
            }
            setFile(f);
            setImgElement(img);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        };
        img.onerror = () => showToast.error("Failed to load image.");
        img.src = URL.createObjectURL(f);
    };

    const handleDragEvent = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) loadImage(e.dataTransfer.files[0]);
    };

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) loadImage(e.target.files[0]);
    };

    // ── Crop drag handlers ──
    const handlePointerDown = (e) => {
        if (!imgElement) return;
        e.preventDefault();
        setDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setPosStart({ ...position });
        if (cropAreaRef.current) cropAreaRef.current.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!dragging || !imgElement) return;
        const dx = (e.clientX - dragStart.x) / 150;
        const dy = (e.clientY - dragStart.y) / 150;
        const maxOffset = (zoom - 1) / zoom;
        setPosition({
            x: Math.max(-maxOffset, Math.min(maxOffset, posStart.x + dx)),
            y: Math.max(-maxOffset, Math.min(maxOffset, posStart.y + dy)),
        });
    };

    const handlePointerUp = (e) => {
        setDragging(false);
        if (cropAreaRef.current) cropAreaRef.current.releasePointerCapture(e.pointerId);
    };

    const handleWheel = (e) => {
        if (!imgElement) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => {
            const next = Math.max(1, Math.min(3, prev + delta));
            // Clamp position on zoom change
            const maxOffset = (next - 1) / next;
            setPosition(p => ({
                x: Math.max(-maxOffset, Math.min(maxOffset, p.x)),
                y: Math.max(-maxOffset, Math.min(maxOffset, p.y)),
            }));
            return next;
        });
    };

    const handleReset = () => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    // ── Get preview style ──
    const getPreviewStyle = () => {
        if (!imgElement) return {};
        const scale = zoom;
        const translateX = position.x * 50 * zoom;
        const translateY = position.y * 50 * zoom;
        return {
            backgroundImage: `url(${imgElement.src})`,
            backgroundSize: `${scale * 100}%`,
            backgroundPosition: `${50 - translateX}% ${50 - translateY}%`,
            backgroundRepeat: "no-repeat",
        };
    };

    // ── Upload ──
    const handleUpload = async () => {
        if (!file || !imgElement || !userId) return;
        setUploading(true);
        setProgress(0);

        let compressed;
        try {
            const canvas = renderCroppedCanvas(imgElement, position, zoom);
            compressed = await compressCanvas(canvas);
        } catch (error) {
            showToast.error(error.message || "Failed to process photo.");
            setUploading(false);
            return;
        }

        const attemptUpload = async (attempt = 1) => {
            try {
                const filePath = `${userId}/avatar.webp`;

                setProgress(30);

                const { data, error } = await supabase.storage
                    .from("avatars")
                    .upload(filePath, compressed, {
                        contentType: compressed.type || "image/webp",
                        upsert: true,
                    });

                if (error) throw error;

                setProgress(70);

                const { data: { publicUrl } } = supabase.storage
                    .from("avatars")
                    .getPublicUrl(data.path);

                // Cache-bust so the new image appears instantly without page refresh
                const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

                // Update profile in Supabase
                const { error: profileError } = await supabase
                    .from("profiles")
                    .update({
                        profile_picture_url: cacheBustedUrl,
                        updatedAt: new Date().toISOString(),
                    })
                    .eq("id", userId);

                if (profileError) {
                    console.error("Profile update error:", profileError);
                    // Try upsert as fallback
                    await supabase
                        .from("profiles")
                        .upsert({
                            id: userId,
                            profile_picture_url: cacheBustedUrl,
                            updatedAt: new Date().toISOString(),
                        }, { onConflict: "id" });
                }

                // Update Supabase auth user metadata
                await supabase.auth.updateUser({ data: { avatar_url: cacheBustedUrl } });

                setProgress(100);
                showToast.success("Profile photo updated!");
                if (onUploadSuccess) onUploadSuccess(cacheBustedUrl);
                eventBus.emit("PROFILE_UPDATED", { type: "avatar", url: cacheBustedUrl });
                onClose();
                setUploading(false);
                setProgress(0);
            } catch (err) {
                if (attempt < 3) {
                    showToast.error(`Upload failed, retrying (${attempt}/3)...`);
                    setProgress(0);
                    setTimeout(() => attemptUpload(attempt + 1), 1000 * attempt);
                } else {
                    console.error("Upload failed after retries:", err);
                    showToast.error("Failed to upload after 3 attempts.");
                    setUploading(false);
                    setProgress(0);
                }
            }
        };

        attemptUpload();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={!uploading ? onClose : undefined} />
            <div className="relative bg-[#1A1D24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-bold text-white">Update Profile Photo</h2>
                    <button onClick={onClose} disabled={uploading} className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50">
                        <X size={20} className="text-textSecondary" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col items-center">
                    {!imgElement ? (
                        /* Drop zone */
                        <div
                            className={`relative w-64 h-64 rounded-full border-4 border-dashed flex items-center justify-center overflow-hidden transition-all cursor-pointer ${dragActive ? "border-accent bg-accent/10" : "border-white/10 bg-black/20"}`}
                            onDragEnter={handleDragEvent}
                            onDragLeave={handleDragEvent}
                            onDragOver={handleDragEvent}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {currentAvatar ? (
                                <img src={currentAvatar} alt="Current" className="w-full h-full object-cover opacity-40 grayscale" />
                            ) : (
                                <div className="flex flex-col items-center text-textSecondary gap-2">
                                    <Upload size={48} />
                                    <span className="text-sm font-medium">Drag & Drop</span>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                                className="hidden" onChange={handleFileChange} />
                        </div>
                    ) : (
                        /* Crop area */
                        <div className="flex flex-col items-center gap-4 w-full">
                            <div
                                ref={cropAreaRef}
                                className="w-64 h-64 rounded-full overflow-hidden border-4 border-white/20 cursor-grab active:cursor-grabbing touch-none select-none"
                                style={getPreviewStyle()}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onWheel={handleWheel}
                            />

                            {/* Zoom controls */}
                            <div className="flex items-center gap-3 w-full max-w-[280px]">
                                <button onClick={() => setZoom(prev => Math.max(1, prev - 0.1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                    <ZoomOut size={16} className="text-textSecondary" />
                                </button>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.05"
                                    value={zoom}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value);
                                        setZoom(val);
                                        const maxOffset = (val - 1) / val;
                                        setPosition(p => ({
                                            x: Math.max(-maxOffset, Math.min(maxOffset, p.x)),
                                            y: Math.max(-maxOffset, Math.min(maxOffset, p.y)),
                                        }));
                                    }}
                                    className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
                                />
                                <button onClick={() => setZoom(prev => Math.min(3, prev + 0.1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                    <ZoomIn size={16} className="text-textSecondary" />
                                </button>
                                <button onClick={handleReset} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Reset">
                                    <RotateCcw size={14} className="text-textSecondary" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 text-center">
                        <p className="text-xs text-textSecondary/60">
                            JPG, PNG, WEBP · Max 2MB · Min 256×256 · Recommended 512×512+
                        </p>
                        {imgElement && (
                            <button onClick={() => { setFile(null); setImgElement(null); setZoom(1); setPosition({ x: 0, y: 0 }); }}
                                className="mt-2 text-accent text-sm font-semibold hover:underline">
                                Choose different photo
                            </button>
                        )}
                        {!imgElement && (
                            <button onClick={() => fileInputRef.current?.click()}
                                className="mt-2 text-accent text-sm font-semibold hover:underline">
                                Choose from computer
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-white/5">
                    {uploading && (
                        <div className="mb-3">
                            <div className="flex justify-between text-xs text-textSecondary mb-1">
                                <span>Uploading...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} disabled={uploading}
                            className="px-4 py-2 text-sm font-medium text-textSecondary hover:text-white transition-colors disabled:opacity-50">
                            Cancel
                        </button>
                        <button onClick={handleUpload} disabled={!imgElement || uploading}
                            className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${!imgElement || uploading ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20"}`}>
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            {uploading ? "Uploading..." : "Save Photo"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
