import { NextResponse } from 'next/server';
import { searchRateLimiter } from '@/lib/rateLimiter';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Search API route with rate limiting and caching
 * GET /api/search?query=...&type=multi
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');
        const type = searchParams.get('type') || 'multi';
        const tvId = searchParams.get('tvId');
        const detail = searchParams.get('detail');
        const season = searchParams.get('season');

        // ── TV detail endpoints (seasons / episodes) ──
        if (tvId && detail === 'seasons') {
            const url = `${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('TMDB API error');
            const data = await res.json();
            return NextResponse.json({ seasons: data.seasons || [] }, {
                headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
            });
        }

        if (tvId && detail === 'episodes' && season) {
            const url = `${TMDB_BASE_URL}/tv/${tvId}/season/${season}?api_key=${TMDB_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('TMDB API error');
            const data = await res.json();
            return NextResponse.json({ episodes: data.episodes || [] }, {
                headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
            });
        }

        // ── Images endpoint (backdrops) for movies or TV ──
        const movieId = searchParams.get('movieId');
        if ((tvId || movieId) && detail === 'images') {
            const mediaType = tvId ? 'tv' : 'movie';
            const mediaId = tvId || movieId;
            const url = `${TMDB_BASE_URL}/${mediaType}/${mediaId}/images?api_key=${TMDB_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('TMDB API error');
            const data = await res.json();
            return NextResponse.json({ backdrops: data.backdrops || [], posters: data.posters || [] }, {
                headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
            });
        }

        if (!query) {
            return NextResponse.json(
                { error: 'Query parameter is required' },
                { status: 400 }
            );
        }

        // Rate limiting
        const clientId = request.headers.get('x-forwarded-for') || 'anonymous';
        const rateLimitResult = searchRateLimiter.check(clientId);

        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests',
                    retryAfter: rateLimitResult.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': rateLimitResult.retryAfter.toString(),
                        'X-RateLimit-Remaining': '0',
                    },
                }
            );
        }

        // Fetch from TMDB
        const url = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
            query
        )}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('TMDB API error');
        }

        const data = await response.json();

        // Return with cache headers and rate limit info
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
