"use client";

import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, retryCount: 0 };
        this.maxAutoRetries = props.maxAutoRetries ?? 1;
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary captured error:", error, errorInfo);

        // Log to monitoring (extensible — add Sentry/Analytics here)
        if (typeof window !== "undefined") {
            try {
                const errorLog = JSON.parse(sessionStorage.getItem("vn_error_log") || "[]");
                errorLog.push({
                    message: error?.message || "Unknown",
                    component: errorInfo?.componentStack?.slice(0, 200),
                    timestamp: Date.now(),
                    url: window.location.href,
                });
                // Keep last 20 errors
                sessionStorage.setItem("vn_error_log", JSON.stringify(errorLog.slice(-20)));
            } catch {}
        }

        // Auto-retry once if under threshold
        if (this.state.retryCount < this.maxAutoRetries) {
            setTimeout(() => {
                this.setState((prev) => ({
                    hasError: false,
                    error: null,
                    retryCount: prev.retryCount + 1,
                }));
            }, 500);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 rounded-xl border border-white/10 m-4">
                    <AlertTriangle size={32} className="text-warning mb-3" />
                    <h3 className="text-lg font-bold text-white mb-2">Something went wrong</h3>
                    <p className="text-textSecondary text-sm mb-4">
                        {this.state.error?.message || "An unexpected error occurred in this section."}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCcw size={14} />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
