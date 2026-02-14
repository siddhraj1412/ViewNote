import { NextResponse } from 'next/server';
import { apiRateLimiter } from '@/lib/rateLimiter';

/**
 * Trending content API route
 * GET /api/trending?type=movie&timeWindow=week
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const origin = new URL(request.url).origin;
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
        const endpoint = `trending/${type}/${timeWindow}`;
        const response = await fetch(
            `${origin}/api/tmdb?endpoint=${encodeURIComponent(endpoint)}`,
            { next: { revalidate: 3600 } }
        );

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
