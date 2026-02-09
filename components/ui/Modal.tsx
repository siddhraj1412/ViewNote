"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    className?: string;
}

export default function Modal({ isOpen, onClose, children, title, className }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={cn(
                    "relative bg-secondary rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto",
                    className
                )}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary transition"
                >
                    <X size={24} />
                </button>

                {/* Title */}
                {title && (
                    <h2 className="text-2xl font-bold mb-4 pr-8">{title}</h2>
                )}

                {/* Content */}
                {children}
            </div>
        </div>
    );
}
