"use client";

import { Plus } from "lucide-react";

export default function EmptySlot({ onClick, label = "Add" }) {
    return (
        <button
            onClick={onClick}
            className="relative aspect-[2/3] rounded-xl border-2 border-dashed border-white/20 hover:border-accent hover:bg-white/5 transition-all group flex items-center justify-center"
            aria-label={label}
        >
            <div className="flex flex-col items-center gap-2 text-textSecondary group-hover:text-accent transition-colors">
                <Plus size={32} className="opacity-50 group-hover:opacity-100" />
                <span className="text-sm font-medium">{label}</span>
            </div>
        </button>
    );
}
