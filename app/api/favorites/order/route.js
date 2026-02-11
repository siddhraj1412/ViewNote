import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

// PUT /api/favorites/order - Update favorites order
export async function PUT(request) {
    try {
        const body = await request.json();
        const { type, favorites } = body;

        if (!type || !favorites || !Array.isArray(favorites)) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

        const collectionName = `favorites_${type}`;

        // Update order for each favorite
        const updatePromises = favorites.map((item, index) =>
            updateDoc(doc(db, collectionName, item.id), { order: index })
        );

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating favorites order:", error);
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
}
