"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, ArrowLeft, ExternalLink } from "lucide-react";

export default function InAppBrowser({ url, isOpen, onClose, title = "External Content" }) {
    const [mounted, setMounted] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            setLoading(true);
        } else {
            document.body.style.overflow = "unset";
        }

        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleEsc);
        }

        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("keydown", handleEsc);
        };
    }, [isOpen, onClose]);

    const handleRefresh = () => {
        setIframeKey((prev) => prev + 1);
        setLoading(true);
    };

    const handleOpenExternal = () => {
        window.open(url, "_blank", "noopener,noreferrer");
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition"
                        aria-label="Close"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="font-semibold truncate">{title}</h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 hover:bg-white/5 rounded-lg transition"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={handleOpenExternal}
                        className="p-2 hover:bg-white/5 rounded-lg transition"
                        aria-label="Open in new tab"
                    >
                        <ExternalLink size={18} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* URL Bar */}
            <div className="px-4 py-2 bg-secondary/50 border-b border-white/10">
                <div className="flex items-center gap-2 px-3 py-2 bg-background/50 rounded-lg">
                    <span className="text-xs text-textSecondary truncate">{url}</span>
                </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
                <div className="absolute top-20 left-0 right-0 h-1 bg-secondary overflow-hidden">
                    <div className="h-full bg-accent animate-pulse" style={{ width: "30%" }} />
                </div>
            )}

            {/* iFrame */}
            <iframe
                key={iframeKey}
                src={url}
                className="flex-1 w-full border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                onLoad={() => setLoading(false)}
                title={title}
            />
        </div>,
        document.body
    );
}
