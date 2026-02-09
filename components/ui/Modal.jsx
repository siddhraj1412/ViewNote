"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, title, children }) {
    const modalRef = useRef();

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            document.body.style.overflow = "hidden";
            window.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/90 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Content */}
            <div
                ref={modalRef}
                className="relative bg-secondary w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl animate-scale-in"
            >
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tighter uppercase">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-textSecondary hover:text-textPrimary transition"
                    >
                        <X size={28} />
                    </button>
                </div>
                <div className="p-8">{children}</div>
            </div>
        </div>
    );
}
