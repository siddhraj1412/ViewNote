/**
 * Rate limiting utilities for API routes and client-side requests
 */

class RateLimiter {
    constructor(options = {}) {
        this.requests = new Map();
        this.maxRequests = options.maxRequests || 10;
        this.windowMs = options.windowMs || 60000; // 1 minute default
    }

    /**
     * Check if request should be allowed
     * @param {string} identifier - Unique identifier (IP, user ID, etc.)
     * @returns {Object} - { allowed: boolean, remaining: number, resetAt: number }
     */
    check(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];

        // Remove expired requests
        const validRequests = userRequests.filter(
            (timestamp) => now - timestamp < this.windowMs
        );

        if (validRequests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...validRequests);
            const resetAt = oldestRequest + this.windowMs;
            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfter: Math.ceil((resetAt - now) / 1000),
            };
        }

        // Add current request
        validRequests.push(now);
        this.requests.set(identifier, validRequests);

        return {
            allowed: true,
            remaining: this.maxRequests - validRequests.length,
            resetAt: now + this.windowMs,
        };
    }

    /**
     * Reset rate limit for identifier
     */
    reset(identifier) {
        this.requests.delete(identifier);
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [identifier, timestamps] of this.requests.entries()) {
            const validRequests = timestamps.filter(
                (timestamp) => now - timestamp < this.windowMs
            );
            if (validRequests.length === 0) {
                this.requests.delete(identifier);
            } else {
                this.requests.set(identifier, validRequests);
            }
        }
    }
}

/**
 * Debounce function for search and other frequent operations
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for scroll and resize events
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Create rate limiter instances
export const apiRateLimiter = new RateLimiter({
    maxRequests: 30,
    windowMs: 60000, // 30 requests per minute
});

export const searchRateLimiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 10000, // 10 requests per 10 seconds
});

// Cleanup expired entries every 5 minutes (with HMR guard)
let _rateLimiterCleanupInterval;
if (typeof window !== 'undefined') {
    if (_rateLimiterCleanupInterval) clearInterval(_rateLimiterCleanupInterval);
    _rateLimiterCleanupInterval = setInterval(() => {
        apiRateLimiter.cleanup();
        searchRateLimiter.cleanup();
    }, 5 * 60 * 1000);
}

export default RateLimiter;
