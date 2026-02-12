import { NextResponse } from 'next/server';

/**
 * Middleware for URL redirects and security headers.
 * 
 * Old URL patterns are handled by their respective route pages
 * (e.g. /movie/[id]/page.js fetches data and redirects client-side).
 * 
 * This middleware handles:
 * - Security headers
 * - Cache headers for API routes
 * - Canonical URL enforcement (trailing slashes, etc.)
 */
export function middleware(request) {
    const { pathname } = request.nextUrl;

    // Skip for static assets
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|avif)$/)
    ) {
        return NextResponse.next();
    }

    // Remove trailing slashes (except root)
    if (pathname !== '/' && pathname.endsWith('/')) {
        const url = request.nextUrl.clone();
        url.pathname = pathname.slice(0, -1);
        return NextResponse.redirect(url, 301);
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

    // Cache headers for API routes
    if (pathname.startsWith('/api/')) {
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
