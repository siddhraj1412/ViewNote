"use client";

import { cn } from "@/lib/utils";

export default function Card({ children, className, hover = false }) {
    return (
        <div
            className={cn(
                "bg-secondary rounded-2xl p-6 border border-white/5",
                hover && "hover:border-accent/40 hover:bg-white/[0.03] transition-all duration-300",
                className
            )}
        >
            {children}
        </div>
    );
}
