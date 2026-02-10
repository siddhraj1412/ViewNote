import { NextResponse } from 'next/server';

/**
 * Rate limiting middleware for Next.js
 */
export function middleware(request) {
    // Skip rate limiting for static assets
    if (
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/static') ||
        request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|avif)$/)
    ) {
        return NextResponse.next();
    }

    // Add security headers
    const response = NextResponse.next();

    // Security headers
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()'
    );

    // Cache headers for static content
    if (request.nextUrl.pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
