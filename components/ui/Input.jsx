"use client";

import { cn } from "@/lib/utils";

export default function Input({ label, error, className, id, ...props }) {
    return (
        <div className="w-full space-y-2">
            {label && (
                <label
                    htmlFor={id}
                    className="block text-sm font-bold text-textSecondary tracking-wide uppercase"
                >
                    {label}
                </label>
            )}
            <input
                id={id}
                className={cn(
                    "w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-textSecondary/50",
                    error && "border-warning focus:border-warning focus:ring-warning",
                    className
                )}
                {...props}
            />
            {error && <p className="text-sm text-warning font-medium">{error}</p>}
        </div>
    );
}
