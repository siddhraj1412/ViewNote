"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

/**
 * /profile → redirects to /profile/:uid
 * This ensures old profile links still work
 */
export default function ProfileRedirect() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (user) {
            router.replace(`/profile/${user.uid}`);
        } else {
            router.replace("/login");
        }
    }, [user, loading, router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-2xl text-textSecondary">Loading...</div>
        </div>
    );
}
