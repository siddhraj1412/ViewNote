"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export default function Input({ label, error, className, id, type, ...props }) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

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
            <div className="relative">
                <input
                    id={id}
                    type={isPassword && showPassword ? "text" : type}
                    className={cn(
                        "w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-textSecondary/50",
                        isPassword && "pr-12",
                        error && "border-warning focus:border-warning focus:ring-warning",
                        className
                    )}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-white transition-colors p-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {error && <p className="text-sm text-warning font-medium">{error}</p>}
        </div>
    );
}
