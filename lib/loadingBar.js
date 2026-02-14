import NProgress from "nprogress";

// Configure NProgress
NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.08,
    easing: "linear",
    speed: 400,
});

// Request counter for debouncing
let requestCount = 0;
let debounceTimer = null;
let completeTimer = null;
let startedAt = 0;

const MIN_VISIBLE_MS = 450;
const IDLE_BEFORE_DONE_MS = 180;

export const loadingBar = {
    /**
     * Start loading bar with debounce
     */
    start() {
        requestCount++;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        if (completeTimer) {
            clearTimeout(completeTimer);
            completeTimer = null;
        }

        debounceTimer = setTimeout(() => {
            if (requestCount > 0) {
                if (!startedAt) startedAt = Date.now();
                NProgress.start();
            }
        }, 100); // 100ms debounce
    },

    /**
     * Complete loading bar
     */
    done() {
        requestCount = Math.max(0, requestCount - 1);

        if (requestCount === 0) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            if (completeTimer) {
                clearTimeout(completeTimer);
            }

            const elapsed = startedAt ? Date.now() - startedAt : MIN_VISIBLE_MS;
            const waitForMin = Math.max(0, MIN_VISIBLE_MS - elapsed);

            completeTimer = setTimeout(() => {
                NProgress.done();
                startedAt = 0;
                completeTimer = null;
            }, waitForMin + IDLE_BEFORE_DONE_MS);
        }
    },

    /**
     * Force complete (reset counter)
     */
    forceDone() {
        requestCount = 0;
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        if (completeTimer) {
            clearTimeout(completeTimer);
            completeTimer = null;
        }
        startedAt = 0;
        NProgress.done();
    },

    /**
     * Increment progress
     */
    inc() {
        NProgress.inc();
    },

    /**
     * Set specific progress value
     */
    set(value) {
        NProgress.set(value);
    },
};

// Fetch interceptor — only for client-side browser fetches
if (typeof window !== "undefined") {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
        // Skip loading bar for background/internal requests
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        const isIgnored = url.includes("firestore") || url.includes("googleapis");
        const shouldTrackInternalApi =
            url.startsWith("/api/tmdb") ||
            url.startsWith("/api/search") ||
            url.startsWith("/api/trending");

        if (!isIgnored && (!url.startsWith("/api/") || shouldTrackInternalApi)) {
            loadingBar.start();
        }

        try {
            const response = await originalFetch(...args);
            if (!isIgnored && (!url.startsWith("/api/") || shouldTrackInternalApi)) {
                loadingBar.done();
            }
            return response;
        } catch (error) {
            if (!isIgnored && (!url.startsWith("/api/") || shouldTrackInternalApi)) {
                loadingBar.done();
            }
            // Don't swallow the error — let callers handle it
            throw error;
        }
    };
}
