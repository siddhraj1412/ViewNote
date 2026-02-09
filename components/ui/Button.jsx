"use client";

import { cn } from "@/lib/utils";

export default function Button({
    children,
    className,
    variant = "primary",
    size = "md",
    disabled = false,
    onClick,
    type = "button",
    ...props
}) {
    const variants = {
        primary: "bg-accent text-background hover:bg-opacity-90",
        secondary: "bg-secondary text-textPrimary hover:bg-opacity-80",
        outline: "border-2 border-accent text-accent hover:bg-accent hover:text-background",
        danger: "bg-warning text-white hover:bg-opacity-90",
    };

    const sizes = {
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg",
    };

    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
