import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function GET(request, { params }) {
    try {
        const { username } = await params;

        if (!username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }

        const lowerUsername = username.toLowerCase();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, displayName, profile_picture_url, profile_banner_url, bio, createdAt")
            .eq("username_lowercase", lowerUsername)
            .single();

        if (error && error.code === "PGRST116") {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }
        if (error) throw error;

        return NextResponse.json({
            uid: data.id,
            username: data.username || data.displayName,
            displayName: data.displayName,
            profile_picture_url: data.profile_picture_url || null,
            profile_banner_url: data.profile_banner_url || null,
            bio: data.bio || null,
            createdAt: data.createdAt || null,
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
