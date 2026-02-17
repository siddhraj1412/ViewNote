import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware for URL redirects, security headers, and Supabase session refresh.
 */
export async function middleware(request) {
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
    let response = NextResponse.next();

    // ─── Supabase session refresh ───
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => {
                            request.cookies.set(name, value);
                        });
                        response = NextResponse.next({ request });
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options);
                        });
                    },
                },
            }
        );
        // Refresh session token if expired
        await supabase.auth.getUser();
    } catch (_) {
        // Non-critical — session refresh failure doesn't block the request
    }

    // Security headers
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()'
    );

    // Cache headers for read-only API routes only
    if (pathname.startsWith('/api/')) {
        const method = request.method.toUpperCase();
        if (method === 'GET') {
            // Cache GET requests with stale-while-revalidate
            response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        } else {
            // Never cache mutation requests
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
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
