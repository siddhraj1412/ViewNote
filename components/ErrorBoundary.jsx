"use client";

import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You could log the error to an error reporting service here
        console.error("ErrorBoundary captured error:", error, errorInfo);
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
