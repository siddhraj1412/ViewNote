import NProgress from "nprogress";

// Configure NProgress for realistic progress behavior
NProgress.configure({
    showSpinner: false,
    trickleSpeed: 300,
    minimum: 0.1,
    easing: "ease",
    speed: 500,
    trickle: true,
});

let active = false;
let safetyTimer = null;
let startTime = 0;
let pendingStart = null;

const MIN_DISPLAY_MS = 250; // Prevent flash for very fast nav
const COALESCE_MS = 50; // Coalesce rapid start() calls

export const loadingBar = {
    /**
     * Start loading bar (coalesced — rapid calls within 50ms are merged)
     */
    start() {
        if (active) return;

        // Coalesce rapid start() calls
        if (pendingStart) return;
        pendingStart = setTimeout(() => {
            pendingStart = null;
            if (active) return;
            active = true;
            startTime = Date.now();
            NProgress.start();

            // Safety: auto-complete after 12s to prevent infinite bar
            clearTimeout(safetyTimer);
            safetyTimer = setTimeout(() => {
                this.forceDone();
            }, 12000);
        }, COALESCE_MS);
    },

    /**
     * Complete loading bar (ensures minimum display time)
     */
    done() {
        // Cancel pending start that hasn't fired yet
        if (pendingStart) {
            clearTimeout(pendingStart);
            pendingStart = null;
            return;
        }
        if (!active) return;

        const elapsed = Date.now() - startTime;
        const remaining = MIN_DISPLAY_MS - elapsed;

        if (remaining > 0) {
            setTimeout(() => {
                active = false;
                clearTimeout(safetyTimer);
                NProgress.done();
            }, remaining);
        } else {
            active = false;
            clearTimeout(safetyTimer);
            NProgress.done();
        }
    },

    /**
     * Force complete (reset state immediately)
     */
    forceDone() {
        if (pendingStart) {
            clearTimeout(pendingStart);
            pendingStart = null;
        }
        active = false;
        clearTimeout(safetyTimer);
        NProgress.done();
    },

    /**
     * Check if loading bar is currently active
     */
    isActive() {
        return active || pendingStart !== null;
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
