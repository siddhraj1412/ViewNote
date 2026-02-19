import { NextResponse } from 'next/server';

/**
 * Simple server-side TMDB proxy
 * Usage: GET /api/tmdb/{resource}/{id}?other=params
 * Example: /api/tmdb/movie/550
 *
 * Notes:
 * - Uses `process.env.TMDB_API_KEY` (server-only) or falls back to `NEXT_PUBLIC_TMDB_API_KEY`.
 * - Only forwards GET requests and returns TMDB response (including non-JSON like images).
 */

export async function GET(req, { params }) {
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing TMDB API key in env (TMDB_API_KEY)' }, { status: 500 });
  }

  const pathParts = Array.isArray(params.path) ? params.path : [params.path];
  const path = pathParts.filter(Boolean).join('/');

  const reqUrl = new URL(req.url);
  // Preserve any client query params and append api_key
  const clientQs = reqUrl.searchParams.toString();
  const tmdbQs = clientQs ? `${clientQs}&api_key=${apiKey}` : `api_key=${apiKey}`;
  const tmdbUrl = `https://api.themoviedb.org/3/${path}?${tmdbQs}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(tmdbUrl, { signal: controller.signal });
    clearTimeout(timeout);

    // Stream response back to client preserving content-type
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    const msg = err?.message || String(err);
    return NextResponse.json({ error: `Proxy error: ${msg}` }, { status: 502 });
  }
}
