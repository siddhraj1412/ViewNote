import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// GET /api/watched - Get watched content for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const watchedSnap = await getDocs(
            query(collection(db, "watched"), where("userId", "==", userId))
        );

        const watched = watchedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const movies = watched.filter(item => item.mediaType === "movie");
        const tv = watched.filter(item => item.mediaType === "tv");

        return NextResponse.json({ movies, tv });
    } catch (error) {
        console.error("Error fetching watched:", error);
        return NextResponse.json({ error: "Failed to fetch watched" }, { status: 500 });
    }
}
