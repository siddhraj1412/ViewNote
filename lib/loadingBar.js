import NProgress from "nprogress";

// Configure NProgress for realistic progress behavior
NProgress.configure({
    showSpinner: false,
    trickleSpeed: 300,
    minimum: 0.1,
    easing: "ease",
    speed: 500,
    // Custom trickle function for realistic progress that slows as it approaches completion
    trickle: true,
});

let active = false;
let safetyTimer = null;

export const loadingBar = {
    /**
     * Start loading bar (single start per navigation)
     */
    start() {
        if (active) return;
        active = true;
        NProgress.start();

        // Safety: auto-complete after 8 seconds to prevent infinite bar
        clearTimeout(safetyTimer);
        safetyTimer = setTimeout(() => {
            this.forceDone();
        }, 8000);
    },

    /**
     * Complete loading bar
     */
    done() {
        if (!active) return;
        active = false;
        clearTimeout(safetyTimer);
        NProgress.done();
    },

    /**
     * Force complete (reset state)
     */
    forceDone() {
        active = false;
        clearTimeout(safetyTimer);
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
