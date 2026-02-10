"use client";

import { Component } from "react";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
        this.setState({ error, errorInfo });

        // Log to monitoring service in production
        if (process.env.NODE_ENV === "production") {
            // Send to error tracking service (Sentry, LogRocket, etc.)
            console.error("Production error:", { error, errorInfo });
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-secondary border border-white/10 rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                        <p className="text-textSecondary mb-6">
                            We encountered an unexpected error. Please try refreshing the page.
                        </p>
                        {process.env.NODE_ENV === "development" && this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="cursor-pointer text-sm text-textSecondary mb-2">
                                    Error Details
                                </summary>
                                <pre className="text-xs bg-background p-4 rounded-lg overflow-auto max-h-40">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition font-medium"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-accent hover:bg-accent/90 rounded-lg transition font-medium"
                            >
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
