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
            .from("user_paused")
            .select("*")
            .eq("userId", userId);

        if (error) throw error;

        const movies = (data || []).filter(item => item.mediaType === "movie");
        const tv = (data || []).filter(item => item.mediaType === "tv");

        return NextResponse.json({ movies, tv });
    } catch (error) {
        console.error("Error fetching paused:", error);
        return NextResponse.json({ error: "Failed to fetch paused" }, { status: 500 });
    }
}
