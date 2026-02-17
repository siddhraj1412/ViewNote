import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

// POST /api/upload — Upload images via server-side Supabase with auth verification
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const userId = formData.get("userId");
        const bucket = formData.get("bucket") || "avatars";
        const path = formData.get("path");

        if (!file || !userId) {
            return NextResponse.json({ error: "File and user ID required" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, WEBP, or GIF." }, { status: 400 });
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify the user is authenticated and matches userId
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || user.id !== userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filePath = path || `${userId}/avatar.webp`;
        const contentType = file.type || "image/webp";

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, buffer, {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error("Storage upload error:", error);
            return NextResponse.json({ error: "Upload failed: " + error.message }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

        // Add cache-busting timestamp
        const url = `${publicUrl}?t=${Date.now()}`;

        return NextResponse.json({
            success: true,
            url,
            path: data.path,
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
}
