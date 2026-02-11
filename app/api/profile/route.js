import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// GET /api/profile - Get user profile
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const profileRef = doc(db, "user_profiles", userId);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            return NextResponse.json(profileSnap.data());
        } else {
            return NextResponse.json({
                profile_picture_url: "",
                bio: "",
                favorite_movie_id: null,
                favorite_series_id: null,
                favorite_episode_id: null,
                profile_banner_url: "",
            });
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

// POST /api/profile - Update user profile
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, ...updates } = body;

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const profileRef = doc(db, "user_profiles", userId);
        await setDoc(profileRef, { ...updates, userId, updatedAt: new Date().toISOString() }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
