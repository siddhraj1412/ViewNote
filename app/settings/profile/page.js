"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /settings/profile redirects to /settings
 * This ensures the Edit Profile button works correctly
 */
export default function SettingsProfileRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/settings");
    }, [router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-2xl text-textSecondary">Loading settings...</div>
        </div>
    );
}
