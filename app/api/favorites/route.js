import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

// GET /api/favorites - Get all favorites for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const [moviesSnap, showsSnap, episodesSnap] = await Promise.all([
            getDocs(query(collection(db, "favorites_movies"), where("userId", "==", userId))),
            getDocs(query(collection(db, "favorites_shows"), where("userId", "==", userId))),
            getDocs(query(collection(db, "favorites_episodes"), where("userId", "==", userId))),
        ]);

        const movies = moviesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);
        const shows = showsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);
        const episodes = episodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);

        return NextResponse.json({ movies, shows, episodes });
    } catch (error) {
        console.error("Error fetching favorites:", error);
        return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
    }
}

// POST /api/favorites - Add a favorite
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, type, media } = body;

        if (!userId || !type || !media) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const collectionName = `favorites_${type}`;
        const docRef = doc(db, collectionName, `${userId}_${media.id}`);

        const favoriteData = {
            userId,
            mediaId: media.id,
            mediaType: type === "movies" ? "movie" : type === "shows" ? "tv" : "episode",
            title: media.title || media.name,
            poster_path: media.poster_path,
            release_date: media.release_date || media.first_air_date,
            order: media.order || 0,
            createdAt: new Date().toISOString(),
        };

        await setDoc(docRef, favoriteData);

        return NextResponse.json({ success: true, data: { id: docRef.id, ...favoriteData } });
    } catch (error) {
        console.error("Error adding favorite:", error);
        return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
    }
}
