import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * GET /api/users/[username]
 * 
 * Look up a user profile by username.
 * Returns public profile data (no sensitive fields).
 */
export async function GET(request, { params }) {
    try {
        const { username } = await params;

        if (!username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }

        const lowerUsername = username.toLowerCase();

        const q = query(
            collection(db, "user_profiles"),
            where("username_lowercase", "==", lowerUsername)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Return public profile data only
        return NextResponse.json({
            uid: userDoc.id,
            username: userData.username || userData.displayName,
            displayName: userData.displayName,
            profile_picture_url: userData.profile_picture_url || null,
            profile_banner_url: userData.profile_banner_url || null,
            bio: userData.bio || null,
            createdAt: userData.createdAt || null,
        });
    } catch (error) {
        console.error("Error looking up user:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
