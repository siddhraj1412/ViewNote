import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { validateUsername, suggestUsernames } from "@/lib/slugify";

export async function POST(request) {
    try {
        const { username } = await request.json();

        if (!username) {
            return NextResponse.json(
                { available: false, valid: false, error: "Username is required" },
                { status: 400 }
            );
        }

        const validation = validateUsername(username);
        if (!validation.valid) {
            return NextResponse.json(
                { available: false, valid: false, error: validation.error },
                { status: 200 }
            );
        }

        const lowerUsername = username.toLowerCase();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("profiles")
            .select("id")
            .eq("username_lowercase", lowerUsername)
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
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
