"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Check, Image as ImageIcon, Loader2 } from "lucide-react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import showToast from "@/lib/toast";

export default function AvatarUploadModal({ isOpen, onClose, userId, currentAvatar, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

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

        try {
            const storage = getStorage();
            // Path: /users/{userId}/avatar.webp (or keep original extension, but prompt says avatar.webp preferred or similar. 
            // Prompt: /users/{userId}/avatar.webp
            const storageRef = ref(storage, `users/${userId}/avatar.webp`);

            // Upload
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            // Update Firestore Profile
            const profileRef = doc(db, "user_profiles", userId);
            await updateDoc(profileRef, {
                profile_picture_url: downloadUrl,
                updatedAt: new Date(), // using serverTimestamp logic usually better, but Date() ok for now
            });

            showToast.success("Profile photo updated!");
            if (onUploadSuccess) onUploadSuccess(downloadUrl);
            onClose();
        } catch (error) {
            console.error("Upload failed:", error);
            showToast.error("Failed to upload photo. Try again.");
        } finally {
            setUploading(false);
        }
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
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 text-accent text-sm font-semibold hover:underline"
                        >
                            Choose from computer
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
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
    );
}
