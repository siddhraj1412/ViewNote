/**
 * Recommendation Cache System
 *
 * Provides persistent rotation tracking, user-specific caching,
 * circuit breaker logic, and fallback data management for the homepage.
 *
 * Uses IndexedDB for persistent rotation pools and localStorage as fallback.
 */

const DB_NAME = "viewnote_rec";
const DB_VERSION = 1;
const STORE_ROTATION = "rotation";
const STORE_FALLBACK = "fallback";

// ── IndexedDB helpers ──

function openDB() {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            reject(new Error("IndexedDB unavailable"));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_ROTATION)) {
                db.createObjectStore(STORE_ROTATION, { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains(STORE_FALLBACK)) {
                db.createObjectStore(STORE_FALLBACK, { keyPath: "key" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(storeName, key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

async function idbPut(storeName, value) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            const req = store.put(value);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // Silent fail
    }
}

// ── Rotation Pool (persistent seen IDs across refreshes) ──

const ROTATION_KEY = "vn_rotation_pool";
const MAX_POOL_SIZE = 600;
const POOL_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours
const MIN_COOLDOWN_CYCLES = 5; // ID must be unseen for 5 cycles before reappearing

/**
 * Get the rotation pool (set of previously shown IDs with cycle metadata)
 */
export async function getRotationPool() {
    try {
        const record = await idbGet(STORE_ROTATION, ROTATION_KEY);
        if (record && record.ids && Date.now() - (record.ts || 0) < POOL_EXPIRY_MS) {
            return {
                ids: new Map(record.ids), // Map<id, { addedCycle, lastCycle }>
                cycle: record.cycle || 0,
            };
        }
    } catch {
        // Fallback to localStorage
        try {
            const raw = localStorage.getItem(ROTATION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.ids) && Date.now() - (parsed.ts || 0) < POOL_EXPIRY_MS) {
                    const map = new Map();
                    parsed.ids.forEach((id) => map.set(id, { addedCycle: 0, lastCycle: parsed.cycle || 0 }));
                    return { ids: map, cycle: parsed.cycle || 0 };
                }
            }
        } catch {}
    }
    return { ids: new Map(), cycle: 0 };
}

/**
 * Save updated rotation pool
 */
export async function saveRotationPool(pool) {
    const entries = [...pool.ids.entries()].slice(-MAX_POOL_SIZE);
    const record = {
        key: ROTATION_KEY,
        ids: entries,
        cycle: pool.cycle,
        ts: Date.now(),
    };
    try {
        await idbPut(STORE_ROTATION, record);
    } catch {
        // Fallback to localStorage
        try {
            localStorage.setItem(ROTATION_KEY, JSON.stringify({
                ids: entries.map(([id]) => id),
                cycle: pool.cycle,
                ts: Date.now(),
            }));
        } catch {}
    }
}

/**
 * Check if an ID should be excluded based on cooldown cycles
 */
export function shouldExclude(pool, id) {
    if (!pool.ids.has(id)) return false;
    const meta = pool.ids.get(id);
    const cyclesSinceLast = pool.cycle - (meta.lastCycle || meta.addedCycle || 0);
    return cyclesSinceLast < MIN_COOLDOWN_CYCLES;
}

/**
 * Record shown IDs with current cycle
 */
export function recordShownIds(pool, ids) {
    const nextCycle = pool.cycle + 1;
    ids.forEach((id) => {
        pool.ids.set(id, { addedCycle: nextCycle, lastCycle: nextCycle });
    });
    pool.cycle = nextCycle;
    // Trim old entries when pool exceeds max size
    if (pool.ids.size > MAX_POOL_SIZE) {
        const entries = [...pool.ids.entries()];
        entries.sort((a, b) => (a[1].lastCycle || 0) - (b[1].lastCycle || 0));
        const excess = entries.length - MAX_POOL_SIZE;
        for (let i = 0; i < excess; i++) {
            pool.ids.delete(entries[i][0]);
        }
    }
}

// ── Session Cache (for soft navigations within the same session) ──

const SESSION_CACHE_KEY = "vn_discovery_cache";
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

export function getSessionCache() {
    if (typeof window === "undefined") return null;
    try {
        const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < SESSION_TTL) return parsed;
        }
    } catch {}
    return null;
}

export function setSessionCache(data) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(
            SESSION_CACHE_KEY,
            JSON.stringify({ ...data, timestamp: Date.now() })
        );
    } catch {}
}

export function clearSessionCache() {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(SESSION_CACHE_KEY);
    } catch {}
}

// ── User-Specific Cache Key ──

export function getUserCacheKey(userId) {
    return userId ? `vn_rec_${userId}` : "vn_rec_anon";
}

// ── Fallback / Emergency Dataset ──

const FALLBACK_KEY = "vn_emergency_data";

/**
 * Store a snapshot of working homepage data as emergency fallback
 */
export async function saveFallbackData(sections) {
    const record = {
        key: FALLBACK_KEY,
        sections,
        ts: Date.now(),
    };
    try {
        await idbPut(STORE_FALLBACK, record);
    } catch {
        try {
            localStorage.setItem(FALLBACK_KEY, JSON.stringify(record));
        } catch {}
    }
}

/**
 * Retrieve emergency fallback data (max 24 hours old)
 */
export async function getFallbackData() {
    try {
        const record = await idbGet(STORE_FALLBACK, FALLBACK_KEY);
        if (record && record.sections && Date.now() - (record.ts || 0) < 24 * 60 * 60 * 1000) {
            return record.sections;
        }
    } catch {
        try {
            const raw = localStorage.getItem(FALLBACK_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.sections && Date.now() - (parsed.ts || 0) < 24 * 60 * 60 * 1000) {
                    return parsed.sections;
                }
            }
        } catch {}
    }
    return null;
}

// ── Circuit Breaker ──

const BREAKER_KEY = "vn_circuit_breaker";

const BREAKER_DEFAULTS = {
    failures: 0,
    lastFailure: 0,
    state: "closed", // closed = normal, open = blocking, half-open = testing
};

function getBreaker() {
    if (typeof window === "undefined") return { ...BREAKER_DEFAULTS };
    try {
        const raw = localStorage.getItem(BREAKER_KEY);
        if (raw) return { ...BREAKER_DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return { ...BREAKER_DEFAULTS };
}

function saveBreaker(breaker) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(BREAKER_KEY, JSON.stringify(breaker));
    } catch {}
}

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT = 60 * 1000; // 1 minute

export function isCircuitOpen() {
    const breaker = getBreaker();
    if (breaker.state === "open") {
        if (Date.now() - breaker.lastFailure > RECOVERY_TIMEOUT) {
            // Transition to half-open
            breaker.state = "half-open";
            saveBreaker(breaker);
            return false;
        }
        return true;
    }
    return false;
}

export function recordSuccess() {
    const breaker = getBreaker();
    breaker.failures = 0;
    breaker.state = "closed";
    saveBreaker(breaker);
}

export function recordFailure() {
    const breaker = getBreaker();
    breaker.failures += 1;
    breaker.lastFailure = Date.now();
    if (breaker.failures >= FAILURE_THRESHOLD) {
        breaker.state = "open";
    }
    saveBreaker(breaker);
}

// ── Weighted Shuffle ──

/**
 * Weighted shuffle: items with higher weight appear earlier.
 * Weight function receives an item and returns a number (higher = more likely to appear first).
 */
export function weightedShuffle(items, weightFn) {
    if (!items || items.length === 0) return [];
    const weighted = items.map((item) => ({
        item,
        score: (weightFn ? weightFn(item) : 1) * Math.random(),
    }));
    weighted.sort((a, b) => b.score - a.score);
    return weighted.map((w) => w.item);
}

// ── Deduplication Engine ──

/**
 * Smart dedup picker with rotation awareness, unseen-first preference, and weighted shuffle.
 *
 * @param {Array} arr - candidate items
 * @param {Object} opts
 * @param {number} opts.count - how many to pick (default 10)
 * @param {Set} opts.globalDedup - cross-section dedup set (mutated)
 * @param {Set} opts.userSeenIds - IDs user has watched/rated
 * @param {Object} opts.rotationPool - current rotation pool
 * @param {Function} opts.weightFn - optional weight function
 * @returns {Array} picked items
 */
export function dedupPick(arr, opts = {}) {
    const { count = 10, globalDedup = new Set(), userSeenIds = new Set(), rotationPool = null, weightFn = null } = opts;

    if (!arr || arr.length === 0) return [];

    // Step 1: Remove items already used in other sections or that the user has seen
    const eligible = arr.filter((m) => {
        if (!m || !m.id) return false;
        if (globalDedup.has(m.id)) return false;
        if (userSeenIds.has(m.id)) return false;
        return true;
    });

    // Step 2: Separate into fresh (not in rotation pool) and cooled (past cooldown)
    let freshItems = eligible;
    let cooledItems = [];

    if (rotationPool) {
        freshItems = eligible.filter((m) => !rotationPool.ids.has(m.id));
        cooledItems = eligible.filter((m) => rotationPool.ids.has(m.id) && !shouldExclude(rotationPool, m.id));
    }

    // Step 3: Prefer fresh items; use cooled items only if fresh < minimum threshold
    const pool = freshItems.length >= Math.min(5, count) ? freshItems : [...freshItems, ...cooledItems];

    // Step 4: Weighted shuffle
    const shuffled = weightFn ? weightedShuffle(pool, weightFn) : weightedShuffle(pool);

    // Step 5: Pick top N
    const picked = shuffled.slice(0, count);
    picked.forEach((m) => globalDedup.add(m.id));

    return picked;
}

// ── Invalidation ──

/**
 * Invalidate recommendation cache when user watches or rates something.
 * Called from mediaService after state transitions.
 */
export function invalidateRecommendationCache() {
    clearSessionCache();
}
