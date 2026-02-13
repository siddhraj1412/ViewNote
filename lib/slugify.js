/**
 * Slug generation and URL utilities for SEO-friendly URLs.
 * 
 * URL Patterns:
 *   Movies:      /movies/{slug}               e.g. /movies/the-dark-knight
 *   TV Shows:    /show/{slug}-{tmdbId}         e.g. /show/game-of-thrones-1399
 *   Persons:     /person/{slug}-{tmdbId}       e.g. /person/christopher-nolan-525
 *   Productions: /production/{slug}-{tmdbId}   e.g. /production/warner-bros-174
 *   Profiles:    /{username}                   e.g. /johndoe
 */

// Reserved route segments — usernames cannot match these
export const RESERVED_ROUTES = new Set([
    'login', 'signup', 'search', 'settings', 'profile', 'profiles',
    'movies', 'movie', 'show', 'shows', 'tv', 'person', 'production',
    'api', 'admin', 'auth', 'dashboard', 'feed', 'explore', 'discover',
    'trending', 'popular', 'watchlist', 'favorites', 'notifications',
    'messages', 'help', 'about', 'terms', 'privacy', 'contact',
    'support', 'blog', 'docs', 'status', 'error', 'not-found',
    '404', '500', 'static', 'public', 'assets', 'media', 'upload',
    'uploads', 'images', 'videos', 'download', 'downloads',
    'embed', 'widget', 'callback', 'oauth', 'verify', 'confirm',
    'reset', 'forgot', 'password', 'account', 'billing', 'subscribe',
    'unsubscribe', 'report', 'flag', 'moderate', 'moderator',
    'editor', 'creator', 'partner', 'developer', 'app', 'apps',
    'viewnote', 'viewnode', 'root', 'system', 'null', 'undefined',
    'true', 'false', 'test', 'debug', 'dev', 'staging', 'prod',
    'onboarding',
]);

/**
 * Generate a URL-safe slug from text.
 * 
 * @param {string} text - The text to slugify (movie title, person name, etc.)
 * @returns {string} URL-safe slug
 * 
 * @example
 * generateSlug("The Dark Knight")       → "the-dark-knight"
 * generateSlug("Spider-Man: Homecoming") → "spider-man-homecoming"
 * generateSlug("WALL·E")                → "wall-e"
 * generateSlug("  Hello   World  ")     → "hello-world"
 */
export function generateSlug(text) {
    if (!text || typeof text !== 'string') return '';

    return text
        .toLowerCase()
        .trim()
        // Replace common special chars with hyphens
        .replace(/[·•:;,!?@#$%^&*()+=\[\]{}<>|\\/"'`~]/g, '-')
        // Replace dots that aren't between numbers (preserve version-like patterns)
        .replace(/\.(?!\d)/g, '-')
        .replace(/(?<!\d)\./g, '-')
        // Replace spaces and underscores with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove any remaining non-alphanumeric chars except hyphens
        .replace(/[^a-z0-9-]/g, '')
        // Collapse multiple hyphens
        .replace(/-{2,}/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '');
}

/**
 * Generate URL for a movie.
 * Movies use pure slug URLs with NO numeric ID.
 * 
 * @param {object} movie - Movie object with at least { id, title }
 * @returns {string} URL path e.g. "/movies/the-dark-knight"
 */
export function getMovieUrl(movie) {
    if (!movie) return '/';
    const slug = generateSlug(movie.title || movie.name || '');
    const id = movie.mediaId ?? movie.id;
    if (!slug || !id) return '/';
    return `/movies/${slug}-${id}`;
}

/**
 * Generate URL for a TV show.
 * Shows include the TMDB ID at the end for reliable resolution.
 * 
 * @param {object} show - Show object with at least { id, name }
 * @returns {string} URL path e.g. "/show/game-of-thrones-1399"
 */
export function getShowUrl(show) {
    if (!show) return '/';
    const slug = generateSlug(show.name || show.title || '');
    const id = show.mediaId ?? show.id;
    if (!slug || !id) return '/';
    return `/show/${slug}-${id}`;
}

/**
 * Generate URL for a person.
 * Includes TMDB ID at end for resolution.
 * 
 * @param {object} person - Person object with at least { id, name }
 * @returns {string} URL path e.g. "/person/christopher-nolan-525"
 */
export function getPersonUrl(person) {
    if (!person) return '/';
    const slug = generateSlug(person.name || '');
    const id = person.mediaId ?? person.id;
    if (!slug || !id) return '/';
    return `/person/${slug}-${id}`;
}

/**
 * Generate URL for a production company.
 * Includes TMDB ID at end for resolution.
 * 
 * @param {object} company - Company object with at least { id, name }
 * @returns {string} URL path e.g. "/production/warner-bros-174"
 */
export function getProductionUrl(company) {
    if (!company) return '/';
    const slug = generateSlug(company.name || '');
    const id = company.mediaId ?? company.id;
    if (!slug || !id) return '/';
    return `/production/${slug}-${id}`;
}

/**
 * Generate URL for a media item (movie or TV show) based on type.
 * 
 * @param {object} item - Media item with { id, title/name, mediaType? }
 * @param {string} [type] - "movie" or "tv". Falls back to item.mediaType or item.media_type.
 * @returns {string} URL path
 */
export function getMediaUrl(item, type) {
    if (!item) return '/';
    const mediaType = type || item.mediaType || item.media_type;
    if (mediaType === 'movie') return getMovieUrl(item);
    if (mediaType === 'tv') return getShowUrl(item);
    return '/';
}

/**
 * Generate URL for a user profile.
 * 
 * @param {string} username - The username
 * @param {string} [tab] - Optional tab name
 * @returns {string} URL path e.g. "/johndoe" or "/johndoe?tab=watchlist"
 */
export function getProfileUrl(username, tab) {
    if (!username) return '/profile';
    const path = `/${username}`;
    return tab ? `${path}?tab=${tab}` : path;
}

/**
 * Extract TMDB ID from a combined slug-id string.
 * The ID is the last numeric segment after the final hyphen.
 * 
 * @param {string} combinedSlug - e.g. "game-of-thrones-1399"
 * @returns {{ slug: string, id: number|null }}
 * 
 * @example
 * parseSlugId("game-of-thrones-1399") → { slug: "game-of-thrones", id: 1399 }
 * parseSlugId("the-dark-knight-155")  → { slug: "the-dark-knight", id: 155 }
 * parseSlugId("hamnet")               → { slug: "hamnet", id: null }
 */
export function parseSlugId(combinedSlug) {
    if (!combinedSlug || typeof combinedSlug !== 'string') {
        return { slug: '', id: null };
    }

    // Match trailing number after a hyphen
    const match = combinedSlug.match(/^(.+)-(\d+)$/);
    if (match) {
        return {
            slug: match[1],
            id: parseInt(match[2], 10),
        };
    }

    return { slug: combinedSlug, id: null };
}

/**
 * Validate a username.
 * 
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }

    const trimmed = username.trim();

    if (trimmed.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (trimmed.length > 20) {
        return { valid: false, error: 'Username must be at most 20 characters' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }
    if (/^\d+$/.test(trimmed)) {
        return { valid: false, error: 'Username cannot be all numbers' };
    }
    if (RESERVED_ROUTES.has(trimmed.toLowerCase())) {
        return { valid: false, error: 'This username is reserved' };
    }

    return { valid: true };
}

/**
 * Suggest alternative usernames when the desired one is taken.
 * 
 * @param {string} username - The taken username
 * @returns {string[]} Array of suggestions
 */
export function suggestUsernames(username) {
    const base = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const suggestions = [];
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);

    suggestions.push(`${base}_${year}`);
    suggestions.push(`${base}${Math.floor(Math.random() * 999)}`);
    suggestions.push(`the_${base}`);
    suggestions.push(`${base}_vn`);
    suggestions.push(`real_${base}`);

    return suggestions.filter(s => s.length >= 3 && s.length <= 20).slice(0, 3);
}
