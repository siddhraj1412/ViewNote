"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import showToast from "@/lib/toast";

/**
 * SecuritySection – Change email, change password, resend verification.
 * Shown in Settings page under Account section.
 */
export default function SecuritySection() {
    const {
        user,
        changeEmail,
        changePassword,
        resendVerificationEmail,
        resetPassword,
        getAuthErrorMessage,
    } = useAuth();

    // Supabase stores provider as "google" and "email" (not Firebase's "google.com" / "password")
    const isGoogleUser = user?.providerData?.some((p) => p.providerId === "google") || false;
    const isEmailUser = user?.providerData?.some((p) => p.providerId === "email") || false;
    const emailVerified = user?.emailVerified || false;

    // ── Change Email state ──
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [emailPassword, setEmailPassword] = useState("");
    const [emailLoading, setEmailLoading] = useState(false);

    // ── Change Password state ──
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);

    // ── Resend Verification state ──
    const [verifyLoading, setVerifyLoading] = useState(false);

    // ── Change Email handler ──
    const handleChangeEmail = async () => {
        if (!newEmail || !newEmail.includes("@")) {
            showToast.error("Please enter a valid email");
            return;
        }
        if (!isGoogleUser && emailPassword.length < 6) {
            showToast.error("Please enter your current password");
            return;
        }
        setEmailLoading(true);
        try {
            await changeEmail(newEmail, isGoogleUser ? null : emailPassword);
            showToast.success("Verification email sent to " + newEmail + ". Please confirm to complete the change.");
            setShowEmailForm(false);
            setNewEmail("");
            setEmailPassword("");
        } catch (err) {
            showToast.error(getAuthErrorMessage(err));
        } finally {
            setEmailLoading(false);
        }
    };

    // ── Change Password handler ──
    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            showToast.error("New password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast.error("Passwords do not match");
            return;
        }
        if (currentPassword.length < 6) {
            showToast.error("Please enter your current password");
            return;
        }
        setPasswordLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            showToast.success("Password changed successfully");
            setShowPasswordForm(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            showToast.error(getAuthErrorMessage(err));
        } finally {
            setPasswordLoading(false);
        }
    };

    // ── Resend Verification handler ──
    const handleResendVerification = async () => {
        setVerifyLoading(true);
        try {
            await resendVerificationEmail();
            showToast.success("Verification email sent to " + user.email);
        } catch (err) {
            showToast.error(getAuthErrorMessage(err));
        } finally {
            setVerifyLoading(false);
        }
    };

    // ── Reset Password (email-based) ──
    const handleForgotPassword = async () => {
        try {
            await resetPassword(user.email);
            showToast.success("Password reset email sent to " + user.email);
        } catch (err) {
            showToast.error(getAuthErrorMessage(err));
        }
    };

    return (
        <div className="space-y-3">
            {/* Email Verification Status */}
            {isEmailUser && !emailVerified && (
                <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={18} className="text-yellow-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-yellow-400">Email not verified</p>
                            <p className="text-xs text-textSecondary mt-0.5">Verify your email to secure your account.</p>
                        </div>
                        <button
                            onClick={handleResendVerification}
                            disabled={verifyLoading}
                            className="px-3 py-1.5 text-xs font-medium bg-yellow-500/15 text-yellow-400 rounded-lg hover:bg-yellow-500/25 transition disabled:opacity-50 flex-shrink-0"
                        >
                            {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : "Resend"}
                        </button>
                    </div>
                </div>
            )}

            {isEmailUser && emailVerified && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/5 border border-green-500/10 rounded-xl">
                    <CheckCircle size={14} className="text-green-400" />
                    <span className="text-xs text-green-400">Email verified</span>
                </div>
            )}

            {/* Change Email */}
            {isEmailUser && (
                <div className="bg-secondary rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowEmailForm(!showEmailForm)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition"
                    >
                        <Mail size={18} className="text-accent" />
                        <div className="flex-1 text-left">
                            <span className="text-sm font-medium">Change Email</span>
                            <p className="text-xs text-textSecondary mt-0.5">{user?.email}</p>
                        </div>
                    </button>

                    {showEmailForm && (
                        <div className="px-4 pb-4 space-y-3">
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="New email address"
                                className="w-full px-4 py-2.5 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                            />
                            <input
                                type="password"
                                value={emailPassword}
                                onChange={(e) => setEmailPassword(e.target.value)}
                                placeholder="Current password"
                                className="w-full px-4 py-2.5 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowEmailForm(false); setNewEmail(""); setEmailPassword(""); }}
                                    className="flex-1 py-2 text-xs font-medium bg-white/5 rounded-lg hover:bg-white/10 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleChangeEmail}
                                    disabled={emailLoading || !newEmail}
                                    className="flex-1 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/85 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    {emailLoading ? <Loader2 size={14} className="animate-spin" /> : "Update Email"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Change Password */}
            {isEmailUser && (
                <div className="bg-secondary rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition"
                    >
                        <Lock size={18} className="text-accent" />
                        <div className="flex-1 text-left">
                            <span className="text-sm font-medium">Change Password</span>
                            <p className="text-xs text-textSecondary mt-0.5">Update your account password</p>
                        </div>
                    </button>

                    {showPasswordForm && (
                        <div className="px-4 pb-4 space-y-3">
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Current password"
                                className="w-full px-4 py-2.5 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                            />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New password (min 6 characters)"
                                className="w-full px-4 py-2.5 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                            />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className="w-full px-4 py-2.5 bg-background/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-accent/50 transition"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowPasswordForm(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                                    className="flex-1 py-2 text-xs font-medium bg-white/5 rounded-lg hover:bg-white/10 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={passwordLoading || newPassword.length < 6}
                                    className="flex-1 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/85 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    {passwordLoading ? <Loader2 size={14} className="animate-spin" /> : "Update Password"}
                                </button>
                            </div>
                            <button
                                onClick={handleForgotPassword}
                                className="text-xs text-accent hover:text-accent/80 transition"
                            >
                                Forgot password? Send reset email
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Google user info */}
            {isGoogleUser && !isEmailUser && (
                <div className="flex items-center gap-3 p-4 bg-secondary rounded-xl">
                    <Shield size={18} className="text-accent" />
                    <div>
                        <p className="text-sm font-medium">Google Account</p>
                        <p className="text-xs text-textSecondary mt-0.5">
                            Your account is managed by Google. Password and email changes are handled through your Google account settings.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
