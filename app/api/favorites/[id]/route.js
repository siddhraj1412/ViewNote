import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function DELETE(request, { params }) {
    try {
        const { id } = params;

        if (!id) {
            return NextResponse.json({ error: "ID required" }, { status: 400 });
        }

        const supabase = await createClient();
        const { error } = await supabase.from("favorites").delete().eq("id", id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting favorite:", error);
        return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
    }
}
