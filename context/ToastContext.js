"use client";

import { createContext, useContext, useState } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = (message, type = "info") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            <div className="fixed bottom-4 right-4 z-[200] space-y-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] animate-slide-in ${toast.type === "success"
                                ? "bg-accent text-background"
                                : toast.type === "error"
                                    ? "bg-warning text-white"
                                    : "bg-secondary text-textPrimary"
                            }`}
                    >
                        {toast.type === "success" && <CheckCircle size={20} />}
                        {toast.type === "error" && <XCircle size={20} />}
                        {toast.type === "info" && <Info size={20} />}
                        <span className="flex-1">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}
