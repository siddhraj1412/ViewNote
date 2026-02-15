import NProgress from "nprogress";

// Configure NProgress
NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.08,
    easing: "linear",
    speed: 400,
});

let active = false;

export const loadingBar = {
    /**
     * Start loading bar (single start per navigation)
     */
    start() {
        if (active) return;
        active = true;
        NProgress.start();
    },

    /**
     * Complete loading bar
     */
    done() {
        if (!active) return;
        active = false;
        NProgress.done();
    },

    /**
     * Force complete (reset state)
     */
    forceDone() {
        active = false;
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
