"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

/**
 * DeleteAccountModal
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   onConfirm: (password?: string) => Promise<void>
 *   username: string            — the username to type for confirmation
 *   isGoogleUser: boolean       — if true, skip password field (re-auth via popup)
 */
export default function DeleteAccountModal({
    isOpen,
    onClose,
    onConfirm,
    username,
    isGoogleUser,
}) {
    const [confirmInput, setConfirmInput] = useState("");
    const [password, setPassword] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const usernameMatch =
        confirmInput.trim().toLowerCase() === (username || "").toLowerCase();
    const canDelete = usernameMatch && (isGoogleUser || password.length >= 6);

    const handleDelete = async () => {
        if (!canDelete) return;
        setDeleting(true);
        setError("");
        try {
            await onConfirm(isGoogleUser ? null : password);
        } catch (err) {
            setError(
                err?.message || "Failed to delete account. Please try again."
            );
            setDeleting(false);
        }
    };

    const handleClose = () => {
        if (deleting) return;
        setConfirmInput("");
        setPassword("");
        setError("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-secondary border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                {/* Close button */}
                <button
                    onClick={handleClose}
                    disabled={deleting}
                    className="absolute top-4 right-4 text-textSecondary hover:text-white transition disabled:opacity-50"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    {/* Warning icon */}
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                            <AlertTriangle size={28} className="text-red-500" />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-center mb-2">
                        Permanently Delete Account
                    </h2>

                    {/* Warning text */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6">
                        <p className="text-sm text-red-400 text-center leading-relaxed">
                            <strong>This action cannot be undone.</strong> All your
                            data — watched history, watchlists, ratings, favorites,
                            reviews, and profile — will be permanently deleted.
                        </p>
                    </div>

                    {/* Username confirmation */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-textSecondary mb-1.5">
                            Type your username{" "}
                            <span className="text-white font-bold">{username}</span>{" "}
                            to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder={username}
                            disabled={deleting}
                            className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/25 transition-all disabled:opacity-50"
                        />
                    </div>

                    {/* Password (email users only) */}
                    {!isGoogleUser && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-textSecondary mb-1.5">
                                Enter your password to confirm
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={deleting}
                                className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/25 transition-all disabled:opacity-50"
                            />
                        </div>
                    )}

                    {isGoogleUser && (
                        <p className="text-xs text-textSecondary mb-4 text-center">
                            You will be asked to re-authenticate with Google.
                        </p>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-red-400 text-sm text-center mb-4">
                            {error}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            disabled={deleting}
                            className="flex-1 py-3 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={!canDelete || deleting}
                            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {deleting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    Deleting...
                                </span>
                            ) : (
                                "Delete Account"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
