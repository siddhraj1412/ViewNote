import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";

// DELETE /api/favorites/[id] - Remove a favorite
export async function DELETE(request, { params }) {
    try {
        const { id } = params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        if (!id || !type) {
            return NextResponse.json({ error: "ID and type required" }, { status: 400 });
        }

        const collectionName = `favorites_${type}`;
        await deleteDoc(doc(db, collectionName, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting favorite:", error);
        return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
    }
}
