/**
 * Enhanced in-memory cache with TTL, stale-while-revalidate, and statistics
 */
class Cache {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default TTL
        this.staleTime = options.staleTime || 60 * 1000; // 1 minute stale time
        this.maxSize = options.maxSize || 500; // Maximum cache entries
        this.stats = {
            hits: 0,
            misses: 0,
            staleHits: 0,
            evictions: 0,
        };
    }

    set(key, value, customTTL = null) {
        // Enforce max size with LRU eviction
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.stats.evictions++;
        }

        const ttl = customTTL || this.ttl;
        const expiresAt = Date.now() + ttl;
        const staleAt = Date.now() + ttl - this.staleTime;

        this.cache.set(key, {
            value,
            expiresAt,
            staleAt,
            createdAt: Date.now(),
        });
    }

    get(key, options = {}) {
        const item = this.cache.get(key);
        if (!item) {
            this.stats.misses++;
            return null;
        }

        const now = Date.now();

        // Expired - delete and return null
        if (now > item.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        // Stale but valid - return stale data
        if (now > item.staleAt && options.allowStale !== false) {
            this.stats.staleHits++;
            return { value: item.value, isStale: true };
        }

        // Fresh data
        this.stats.hits++;
        return { value: item.value, isStale: false };
    }

    has(key) {
        const result = this.get(key);
        return result !== null;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            staleHits: 0,
            evictions: 0,
        };
    }

    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: hitRate.toFixed(2) + '%',
        };
    }

    // Clean up expired entries
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        return cleaned;
    }
}

// Create cache instances with different TTLs
export const tmdbCache = new Cache({
    ttl: 10 * 60 * 1000, // 10 minutes for TMDB data
    staleTime: 2 * 60 * 1000, // 2 minutes stale time
    maxSize: 500,
});

export const imageCache = new Cache({
    ttl: 60 * 60 * 1000, // 1 hour for images
    staleTime: 10 * 60 * 1000, // 10 minutes stale time
    maxSize: 1000,
});

// Periodic cleanup every 5 minutes
let _cleanupInterval = null;
if (typeof window !== 'undefined') {
    // Clear any previous interval (HMR safety)
    if (_cleanupInterval) clearInterval(_cleanupInterval);
    _cleanupInterval = setInterval(() => {
        tmdbCache.cleanup();
        imageCache.cleanup();
    }, 5 * 60 * 1000);
}
