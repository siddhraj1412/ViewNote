"use client";

import { useState } from "react";
import supabase from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import showToast from "@/lib/toast";
import Button from "./ui/Button";
import { Upload, X } from "lucide-react";

export default function ImageUpload({ mediaId, mediaType, imageType, onUploadComplete }) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const { user } = useAuth();

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            showToast.error("Please select an image file");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast.error("File size must be less than 5MB");
            return;
        }

        setUploading(true);
        setProgress(10);

        try {
            const filePath = `${user.uid}/${mediaType}/${mediaId}/${imageType}.jpg`;

            setProgress(30);

            const { data, error } = await supabase.storage
                .from("custom-media")
                .upload(filePath, file, {
                    contentType: file.type,
                    upsert: true,
                });

            if (error) throw error;

            setProgress(80);

            const { data: { publicUrl } } = supabase.storage
                .from("custom-media")
                .getPublicUrl(data.path);

            // Cache-bust so the new image appears instantly
            const url = `${publicUrl}?t=${Date.now()}`;

            setProgress(100);
            setUploading(false);
            setProgress(0);
            showToast.success(`${imageType === "poster" ? "Poster" : "Banner"} updated!`);

            if (onUploadComplete) {
                onUploadComplete(url);
            }
        } catch (error) {
            console.error("Upload error:", error);
            showToast.error("Upload failed. Please try again.");
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <div className="relative">
            <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id={`upload-${imageType}`}
                disabled={uploading}
            />
            <label htmlFor={`upload-${imageType}`}>
                <Button
                    as="span"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    className="cursor-pointer"
                >
                    {uploading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
                            {Math.round(progress)}%
                        </>
                    ) : (
                        <>
                            <Upload size={16} className="mr-2" />
                            Upload {imageType === "poster" ? "Poster" : "Banner"}
                        </>
                    )}
                </Button>
            </label>
        </div>
    );
}
