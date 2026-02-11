import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// GET /api/paused - Get paused content for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const pausedSnap = await getDocs(
            query(collection(db, "paused"), where("userId", "==", userId))
        );

        const paused = pausedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const movies = paused.filter(item => item.mediaType === "movie");
        const tv = paused.filter(item => item.mediaType === "tv");

        return NextResponse.json({ movies, tv });
    } catch (error) {
        console.error("Error fetching paused:", error);
        return NextResponse.json({ error: "Failed to fetch paused" }, { status: 500 });
    }
}
