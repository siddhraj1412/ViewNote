"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

const ToastContext = createContext();

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = "info", duration = 3000, action = null) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type, action };

        setToasts((prev) => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const value = {
        showToast,
        removeToast,
        success: (message, action) => showToast(message, "success", 3000, action),
        error: (message, action) => showToast(message, "error", 5000, action),
        warning: (message, action) => showToast(message, "warning", 4000, action),
        info: (message, action) => showToast(message, "info", 3000, action),
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {typeof window !== "undefined" && createPortal(
                <ToastContainer toasts={toasts} onRemove={removeToast} />,
                document.body
            )}
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-3 max-w-md">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function Toast({ toast, onRemove }) {
    const icons = {
        success: <CheckCircle size={20} className="text-green-500" />,
        error: <AlertCircle size={20} className="text-red-500" />,
        warning: <AlertTriangle size={20} className="text-yellow-500" />,
        info: <Info size={20} className="text-blue-500" />,
    };

    const bgColors = {
        success: "bg-green-500/10 border-green-500/20",
        error: "bg-red-500/10 border-red-500/20",
        warning: "bg-yellow-500/10 border-yellow-500/20",
        info: "bg-blue-500/10 border-blue-500/20",
    };

    return (
        <div
            className={`${bgColors[toast.type]} border backdrop-blur-xl rounded-xl p-4 shadow-2xl animate-in slide-in-from-right-full duration-300 flex items-center gap-3 min-w-[320px]`}
        >
            {icons[toast.type]}
            <div className="flex-1">
                <p className="text-sm font-medium">{toast.message}</p>
                {toast.action && (
                    <button
                        onClick={toast.action.onClick}
                        className="text-xs text-accent hover:underline mt-1"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            <button
                onClick={() => onRemove(toast.id)}
                className="p-1 hover:bg-white/5 rounded-lg transition"
            >
                <X size={16} />
            </button>
        </div>
    );
}
