import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, children, title, maxWidth = "80vw" }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
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

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal Container */}
            <div
                className="relative bg-secondary border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
                style={{ maxWidth, width: "100%" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Sticky */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
                    <h2 className="text-2xl font-bold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition"
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
