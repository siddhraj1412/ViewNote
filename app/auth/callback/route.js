import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * GET /auth/callback
 *
 * Handles the OAuth redirect from Supabase (Google sign-in).
 * Exchanges the auth code for a session, then redirects to the app.
 */
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    const next = searchParams.get("next") ?? "/";

    // If Supabase returned an error in the redirect (e.g., trigger failure),
    // still try to proceed — the user may already exist in auth.users
    if (errorParam && !code) {
        console.error(`[Auth Callback] OAuth error: ${errorParam} — ${errorDesc}`);
        // Redirect to login with a descriptive error
        const msg = errorDesc?.includes("Database error")
            ? "signup_db_error"
            : "auth_callback_failed";
        return NextResponse.redirect(`${origin}/login?error=${msg}`);
    }

    if (code) {
        const response = NextResponse.redirect(`${origin}${next}`);
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return response;
        }
        console.error("[Auth Callback] Code exchange failed:", error.message);
    }

    // If no code or exchange failed, redirect to login
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
