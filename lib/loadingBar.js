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

export const loadingBar = {
    /**
     * Start loading bar with debounce
     */
    start() {
        requestCount++;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            if (requestCount > 0) {
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
            NProgress.done();
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
        const isInternal = url.startsWith("/api/") || url.includes("firestore") || url.includes("googleapis");

        if (!isInternal) loadingBar.start();

        try {
            const response = await originalFetch(...args);
            if (!isInternal) loadingBar.done();
            return response;
        } catch (error) {
            if (!isInternal) loadingBar.done();
            // Don't swallow the error — let callers handle it
            throw error;
        }
    };
}
