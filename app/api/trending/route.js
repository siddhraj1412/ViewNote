import { NextResponse } from 'next/server';
import { apiRateLimiter } from '@/lib/rateLimiter';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Trending content API route
 * GET /api/trending?type=movie&timeWindow=week
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'movie';
        const timeWindow = searchParams.get('timeWindow') || 'week';

        // Rate limiting
        const clientId = request.headers.get('x-forwarded-for') || 'anonymous';
        const rateLimitResult = apiRateLimiter.check(clientId);

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
                    },
                }
            );
        }

        // Fetch from TMDB
        const url = `${TMDB_BASE_URL}/trending/${type}/${timeWindow}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url, {
            next: { revalidate: 3600 }, // Revalidate every hour
        });

        if (!response.ok) {
            throw new Error('TMDB API error');
        }

        const data = await response.json();

        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            },
        });
    } catch (error) {
        console.error('Trending API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
