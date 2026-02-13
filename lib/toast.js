import toast from "react-hot-toast";
import { createElement } from "react";

/**
 * Unified toast notification system
 * All components must import from this file, not directly from react-hot-toast
 */

const TOAST_STYLE = {
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.2)",
    color: "#fff",
    backdropFilter: "blur(12px)",
};

export const showToast = {
    success: (message, action = null) => {
        return toast.success(message, {
            duration: 5000,
            position: "top-center",
            style: TOAST_STYLE,
            icon: "✓",
        });
    },

    /** Success toast with a clickable link */
    linked: (message, href) => {
        return toast(
            (t) =>
                createElement(
                    "span",
                    {
                        onClick: (e) => {
                            e.stopPropagation();
                            toast.dismiss(t.id);
                            if (href && typeof window !== "undefined") {
                                // Use pushState + popstate to trigger Next.js client-side nav
                                try {
                                    window.dispatchEvent(new CustomEvent("toast-navigate", { detail: { href } }));
                                } catch {
                                    window.location.href = href;
                                }
                            }
                        },
                        style: { cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" },
                    },
                    createElement("span", null, "✓ "),
                    message,
                    href
                        ? createElement(
                              "span",
                              { style: { color: "#4169E1", fontWeight: 600, marginLeft: 6 } },
                              "View →"
                          )
                        : null
                ),
            {
                duration: 5000,
                position: "top-center",
                style: { ...TOAST_STYLE, cursor: "pointer" },
            }
        );
    },

    error: (message) => {
        return toast.error(message, {
            duration: 5000,
            position: "top-center",
            style: {
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#fff",
                backdropFilter: "blur(12px)",
            },
            icon: "✕",
        });
    },

    info: (message) => {
        return toast(message, {
            duration: 5000,
            position: "top-center",
            style: {
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                color: "#fff",
                backdropFilter: "blur(12px)",
            },
            icon: "ℹ",
        });
    },

    loading: (message) => {
        return toast.loading(message, {
            position: "top-center",
            style: {
                background: "rgba(107, 114, 128, 0.1)",
                border: "1px solid rgba(107, 114, 128, 0.2)",
                color: "#fff",
                backdropFilter: "blur(12px)",
            },
        });
    },

    promise: (promise, messages) => {
        return toast.promise(
            promise,
            {
                loading: messages.loading || "Loading...",
                success: messages.success || "Success!",
                error: messages.error || "Error occurred",
            },
            {
                position: "top-center",
                style: {
                    backdropFilter: "blur(12px)",
                },
            }
        );
    },

    dismiss: (toastId) => {
        toast.dismiss(toastId);
    },

    dismissAll: () => {
        toast.dismiss();
    },
};

// Default export for convenience
export default showToast;
