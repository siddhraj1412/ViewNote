import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { validateUsername, suggestUsernames } from "@/lib/slugify";

/**
 * POST /api/auth/check-username
 * 
 * Check if a username is available and valid.
 * Body: { username: string }
 * Response: { available: boolean, valid: boolean, error?: string, suggestions?: string[] }
 */
export async function POST(request) {
    try {
        const { username } = await request.json();

        if (!username) {
            return NextResponse.json(
                { available: false, valid: false, error: "Username is required" },
                { status: 400 }
            );
        }

        // Validate format
        const validation = validateUsername(username);
        if (!validation.valid) {
            return NextResponse.json(
                { available: false, valid: false, error: validation.error },
                { status: 200 }
            );
        }

        // Check uniqueness (case-insensitive)
        const lowerUsername = username.toLowerCase();
        const q = query(
            collection(db, "user_profiles"),
            where("username_lowercase", "==", lowerUsername)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const suggestions = suggestUsernames(username);
            return NextResponse.json(
                {
                    available: false,
                    valid: true,
                    error: "Username is already taken",
                    suggestions,
                },
                { status: 200 }
            );
        }

        return NextResponse.json(
            { available: true, valid: true },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error checking username:", error);
        return NextResponse.json(
            { available: false, valid: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
