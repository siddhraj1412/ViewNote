import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase env vars missing — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Browser-side Supabase client (singleton).
 * Used in all client components, hooks, and services.
 */
let _client = null;

export function getSupabase() {
    if (_client) return _client;
    _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return _client;
}

/** Default export for convenience — same singleton. */
let supabase;
if (typeof window !== "undefined") {
    supabase = getSupabase();
} else {
    // SSR: create a no-op client that won't throw during module evaluation.
    // Server components should use lib/supabaseServer.js instead.
    supabase = createBrowserClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-key");
}

export default supabase;
