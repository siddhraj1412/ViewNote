import { NextResponse } from "next/server";

// POST /api/upload - Upload profile picture
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const userId = formData.get("userId");

        if (!file || !userId) {
            return NextResponse.json({ error: "File and user ID required" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
        }

        // For now, return placeholder
        // In production, upload to cloud storage (Firebase Storage, Cloudinary, etc.)
        return NextResponse.json({
            success: true,
            url: "/placeholder-profile.jpg",
            message: "Upload feature coming soon",
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
}
