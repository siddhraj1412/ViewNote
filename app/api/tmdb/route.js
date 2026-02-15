import { NextResponse } from "next/server";
import dns from "node:dns";
import RateLimiter from "@/lib/rateLimiter";
import { tmdbCache } from "@/lib/cache";

export const runtime = "nodejs";

dns.setDefaultResultOrder("ipv4first");

const inFlight = new Map();

// Dedicated limiter for TMDB proxy (higher than generic API limiter)
const tmdbRateLimiter = new RateLimiter({
    maxRequests: 300,
    windowMs: 60000,
});

function getClientId(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();

    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    // Fallback so dev doesn't collapse everyone into a single bucket
    return request.headers.get("user-agent") || "anonymous";
}

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get("endpoint");

        if (!endpoint) {
            return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
        }

        if (!TMDB_API_KEY) {
            return NextResponse.json(
                { error: "TMDB API key is missing" },
                { status: 500 }
            );
        }

        const normalized = endpoint.replace(/^\/+/, "");
        const cacheKey = `tmdb:${normalized}`;

        // Rate limiting should not block cache hits, but we still want a stable header value.
        // Compute it up-front so we never reference it before initialization.
        const clientId = getClientId(request);
        const rateLimitResult = tmdbRateLimiter.check(clientId);

        // Serve from cache immediately (including stale) to reduce TMDB traffic
        const cached = tmdbCache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached.value, {
                status: 200,
                headers: {
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
                    "X-Cache": cached.isStale ? "STALE" : "HIT",
                    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
                },
            });
        }

        // In-flight request de-duplication (prevents spikes from causing N TMDB calls)
        if (inFlight.has(cacheKey)) {
            const shared = await inFlight.get(cacheKey);
            return NextResponse.json(shared, {
                status: 200,
                headers: {
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
                    "X-Cache": "DEDUPED",
                },
            });
        }

        // Rate limiting only on cache-miss (upstream fetch) so cache hits never 429
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                {
                    error: "Too many requests",
                    retryAfter: rateLimitResult.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": rateLimitResult.retryAfter.toString(),
                        "X-RateLimit-Remaining": "0",
                    },
                }
            );
        }

        const url = `${TMDB_BASE_URL}/${normalized}${normalized.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}`;

        const fetchPromise = (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const res = await fetch(url, {
                next: { revalidate: 300 },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const contentType = res.headers.get("content-type") || "";
            const isJson = contentType.includes("application/json");

            if (!res.ok) {
                const body = isJson
                    ? await res.json().catch(() => null)
                    : await res.text().catch(() => "");
                const err = new Error("TMDB API error");
                err.status = res.status;
                err.statusText = res.statusText;
                err.body = body;
                throw err;
            }

            const data = isJson ? await res.json() : await res.text();

            // Cache success (10 minutes default in tmdbCache)
            tmdbCache.set(cacheKey, data);
            return data;
        })();

        inFlight.set(cacheKey, fetchPromise);

        try {
            const data = await fetchPromise;
            return NextResponse.json(data, {
                status: 200,
                headers: {
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
                    "X-Cache": "MISS",
                    "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
                },
            });
        } catch (error) {
            // Stale-if-error: if there is cached data (even if stale), serve it
            const staleCached = tmdbCache.get(cacheKey, { allowStale: true });
            if (staleCached) {
                return NextResponse.json(staleCached.value, {
                    status: 200,
                    headers: {
                        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
                        "X-Cache": "STALE_IF_ERROR",
                        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
                    },
                });
            }

            const status = error?.status && Number.isInteger(error.status)
                ? error.status
                : 503;

            return NextResponse.json(
                {
                    error: "TMDB upstream failed",
                    status,
                    statusText: error?.statusText,
                    body: error?.body,
                },
                { status }
            );
        } finally {
            inFlight.delete(cacheKey);
        }
    } catch (error) {
        console.error("TMDB proxy error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error?.message,
                code: error?.code,
                cause: error?.cause
                    ? {
                        message: error.cause?.message,
                        code: error.cause?.code,
                        name: error.cause?.name,
                    }
                    : null,
            },
            { status: 500 }
        );
    }
}
