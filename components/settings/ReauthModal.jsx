"use client";

import { useState } from "react";
import { Lock, Loader2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * ReauthModal – generic reauthentication modal for destructive/sensitive actions.
 *
 * Props:
 *   isOpen        : boolean
 *   onClose       : () => void
 *   onSuccess     : () => void | Promise<void>   — called after successful reauth
 *   title         : string
 *   description   : string
 *   isGoogleUser  : boolean
 */
export default function ReauthModal({
    isOpen,
    onClose,
    onSuccess,
    title = "Confirm your identity",
    description = "Please re-enter your password to continue.",
    isGoogleUser = false,
}) {
    const { reauthenticate, getAuthErrorMessage } = useAuth();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleReauth = async () => {
        setLoading(true);
        setError("");
        try {
            await reauthenticate(isGoogleUser ? null : password);
            if (onSuccess) await onSuccess();
            handleClose();
        } catch (err) {
            setError(getAuthErrorMessage(err));
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        setPassword("");
        setError("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-secondary border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
                <button
                    onClick={handleClose}
                    disabled={loading}
                    className="absolute top-4 right-4 text-textSecondary hover:text-white transition disabled:opacity-50"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                            <Lock size={22} className="text-accent" />
                        </div>
                    </div>

                    <h2 className="text-lg font-bold text-center mb-1">{title}</h2>
                    <p className="text-sm text-textSecondary text-center mb-5">{description}</p>

                    {!isGoogleUser && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-textSecondary mb-1.5">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={loading}
                                onKeyDown={(e) => e.key === "Enter" && password.length >= 6 && handleReauth()}
                                className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all disabled:opacity-50"
                            />
                        </div>
                    )}

                    {isGoogleUser && (
                        <p className="text-xs text-textSecondary mb-4 text-center">
                            You will be asked to re-authenticate with Google.
                        </p>
                    )}

                    {error && (
                        <p className="text-red-400 text-sm text-center mb-4">{error}</p>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 py-3 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReauth}
                            disabled={loading || (!isGoogleUser && password.length < 6)}
                            className="flex-1 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    Verifying...
                                </span>
                            ) : (
                                "Continue"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
