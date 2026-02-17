import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function PUT(request) {
    try {
        const body = await request.json();
        const { type, favorites } = body;

        if (!type || !favorites || !Array.isArray(favorites)) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

        const supabase = await createClient();

        const updatePromises = favorites.map((item, index) =>
            supabase.from("favorites").update({ order: index }).eq("id", item.id)
        );

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating favorites order:", error);
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
}
