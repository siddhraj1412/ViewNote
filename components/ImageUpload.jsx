"use client";

import { useState } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
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
            alert("Please select an image file");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("File size must be less than 5MB");
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            // Create storage reference
            const storageRef = ref(
                storage,
                `customMedia/${user.uid}/${mediaType}/${mediaId}/${imageType}.jpg`
            );

            // Upload file
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(prog);
                },
                (error) => {
                    console.error("Upload error:", error);
                    alert("Upload failed. Please try again.");
                    setUploading(false);
                },
                async () => {
                    // Upload complete
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setUploading(false);
                    setProgress(0);
                    if (onUploadComplete) {
                        onUploadComplete(downloadURL);
                    }
                }
            );
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed. Please try again.");
            setUploading(false);
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
