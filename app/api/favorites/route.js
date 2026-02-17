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
            .from("favorites")
            .select("*")
            .eq("userId", userId)
            .order("order", { ascending: true });

        if (error) throw error;

        const grouped = { movies: [], shows: [], episodes: [] };
        (data || []).forEach((row) => {
            if (grouped[row.category]) grouped[row.category].push(row);
        });

        return NextResponse.json(grouped);
    } catch (error) {
        console.error("Error fetching favorites:", error);
        return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, type, media } = body;

        if (!userId || !type || !media) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const id = `${userId}_${type}_${media.id}`;
        const favoriteData = {
            id,
            userId,
            mediaId: media.id,
            mediaType: type === "movies" ? "movie" : type === "shows" ? "tv" : "episode",
            category: type,
            title: media.title || media.name,
            poster_path: media.poster_path,
            release_date: media.release_date || media.first_air_date,
            order: media.order || 0,
            createdAt: new Date().toISOString(),
        };

        const supabase = await createClient();
        const { error } = await supabase.from("favorites").upsert(favoriteData);
        if (error) throw error;

        return NextResponse.json({ success: true, data: favoriteData });
    } catch (error) {
        console.error("Error adding favorite:", error);
        return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
    }
}
