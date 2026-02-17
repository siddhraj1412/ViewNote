import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error && error.code === "PGRST116") {
            return NextResponse.json({
                profile_picture_url: "",
                bio: "",
                favorite_movie_id: null,
                favorite_series_id: null,
                favorite_episode_id: null,
                profile_banner_url: "",
            });
        }
        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, ...updates } = body;

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const supabase = await createClient();
        const { error } = await supabase
            .from("profiles")
            .update({ ...updates, updatedAt: new Date().toISOString() })
            .eq("id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
