"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error("Error page:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-secondary p-8 rounded-2xl border border-white/5 text-center">
                <h1 className="text-3xl font-bold mb-4 text-warning">
                    Oops! Something went wrong
                </h1>
                <p className="text-textSecondary mb-6">
                    {error?.message || "An unexpected error occurred. Please try again."}
                </p>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={reset}
                        className="bg-accent text-background px-6 py-3 rounded-xl font-bold hover:bg-opacity-90 transition"
                    >
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="bg-secondary border border-accent text-accent px-6 py-3 rounded-xl font-bold hover:bg-accent hover:text-background transition"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
