import toast from "react-hot-toast";

/**
 * Unified toast notification system
 * All components must import from this file, not directly from react-hot-toast
 */

export const showToast = {
    success: (message, action = null) => {
        return toast.success(message, {
            duration: 3000,
            position: "bottom-right",
            style: {
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                color: "#fff",
                backdropFilter: "blur(12px)",
            },
            icon: "✓",
        });
    },

    error: (message) => {
        return toast.error(message, {
            duration: 5000,
            position: "bottom-right",
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
            duration: 3000,
            position: "bottom-right",
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
            position: "bottom-right",
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
                position: "bottom-right",
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
