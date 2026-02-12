"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import showToast from "@/lib/toast";

// ── Client-side image compression: square crop, resize 512x512, webp ≤200KB ──
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            // Validate min resolution
            if (img.width < 200 || img.height < 200) {
                reject(new Error("Image must be at least 200×200 pixels."));
                return;
            }
            // Validate max resolution
            if (img.width > 4096 || img.height > 4096) {
                reject(new Error("Image must be at most 4096×4096 pixels."));
                return;
            }
            // Square center crop
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext("2d");
            // Enable high-quality downscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);

            // Try decreasing quality until ≤200KB
            const tryQuality = (q) => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) { reject(new Error("Compression failed")); return; }
                        if (blob.size > 200 * 1024 && q > 0.3) {
                            tryQuality(q - 0.1);
                        } else {
                            resolve(blob);
                        }
                    },
                    "image/webp",
                    q
                );
            };
            tryQuality(0.85);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = URL.createObjectURL(file);
    });
}

export default function AvatarUploadModal({ isOpen, onClose, userId, currentAvatar, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const uploadTaskRef = useRef(null);

    if (!isOpen) return null;

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateFile = (file) => {
        // 1. Check type
        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        if (!validTypes.includes(file.type)) {
            showToast.error("Invalid file type. Use JPG, PNG, or WEBP.");
            return false;
        }
        // 2. Check size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast.error("File is too large. Max 2MB.");
            return false;
        }
        return true;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selectedFile = e.dataTransfer.files[0];
            if (validateFile(selectedFile)) {
                setFile(selectedFile);
                setPreviewUrl(URL.createObjectURL(selectedFile));
            }
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (validateFile(selectedFile)) {
                setFile(selectedFile);
                setPreviewUrl(URL.createObjectURL(selectedFile));
            }
        }
    };

    const handleUpload = async () => {
        if (!file || !userId) return;
        setUploading(true);
        setProgress(0);

        let compressed;
        try {
            compressed = await compressImage(file);
        } catch (error) {
            showToast.error(error.message || "Failed to process photo.");
            setUploading(false);
            return;
        }

        const attemptUpload = (attempt = 1) => {
            const storage = getStorage();
            const storageRef = ref(storage, `users/${userId}/avatar.webp`);

            const uploadTask = uploadBytesResumable(storageRef, compressed, {
                contentType: "image/webp",
                customMetadata: { uploadedBy: userId },
            });
            uploadTaskRef.current = uploadTask;

            const timeout = setTimeout(() => {
                uploadTask.cancel();
                showToast.error("Upload timed out. Please try again.");
                setUploading(false);
            }, 120000);

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    setProgress(pct);
                },
                (error) => {
                    clearTimeout(timeout);
                    if (error.code === "storage/canceled") {
                        showToast.error("Upload cancelled.");
                        setUploading(false);
                        return;
                    }
                    if (attempt < 3) {
                        showToast.error(`Upload failed, retrying (${attempt}/3)...`);
                        setTimeout(() => attemptUpload(attempt + 1), 1000 * attempt);
                    } else {
                        console.error("Upload failed after retries:", error);
                        showToast.error("Failed to upload photo after 3 attempts.");
                        setUploading(false);
                    }
                },
                async () => {
                    clearTimeout(timeout);
                    try {
                        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        const profileRef = doc(db, "user_profiles", userId);
                        await updateDoc(profileRef, {
                            profile_picture_url: downloadUrl,
                            updatedAt: new Date(),
                        });
                        showToast.success("Profile photo updated!");
                        if (onUploadSuccess) onUploadSuccess(downloadUrl);
                        onClose();
                    } catch (err) {
                        console.error("Post-upload failed:", err);
                        showToast.error("Photo uploaded but profile update failed.");
                    } finally {
                        setUploading(false);
                    }
                }
            );
        };

        attemptUpload();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#1A1D24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-bold text-white">Update Profile Photo</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-textSecondary" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col items-center">

                    {/* Preview / Upload Area */}
                    <div
                        className={`
                            relative w-64 h-64 rounded-full border-4 border-dashed flex items-center justify-center overflow-hidden transition-all
                            ${dragActive ? "border-accent bg-accent/10" : "border-white/10 bg-black/20"}
                            ${previewUrl ? "border-solid border-white/20" : ""}
                        `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : currentAvatar ? (
                            <img src={currentAvatar} alt="Current" className="w-full h-full object-cover opacity-50 grayscale" />
                        ) : (
                            <div className="flex flex-col items-center text-textSecondary gap-2">
                                <ImageIcon size={48} />
                                <span className="text-sm font-medium">Drag & Drop</span>
                            </div>
                        )}

                        {/* Overlay Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleChange}
                            disabled={uploading}
                        />
                    </div>

                    <div className="mt-4 text-center">
                        <p className="text-sm text-textSecondary">
                            Supported: JPG, PNG, WEBP (Max 2MB)
                        </p>
                        <p className="text-xs text-textSecondary/60 mt-1">
                            Min 200×200 · Max 4096×4096 · Auto-cropped to 512×512
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 text-accent text-sm font-semibold hover:underline"
                        >
                            Choose from computer
                        </button>
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
                                <div
                                    className="h-full bg-accent rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="px-4 py-2 text-sm font-medium text-textSecondary hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className={`
                            px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all
                            ${!file || uploading ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20"}
                        `}
                    >
                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploading ? "Uploading..." : "Save Photo"}
                    </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
