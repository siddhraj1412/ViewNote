"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Public routes that don't require username
const PUBLIC_PATHS = [
    "/login",
    "/signup",
    "/onboarding",
    "/api",
];

function isPublicPath(pathname) {
    return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default function UsernameGuard({ children }) {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!user) return; // not logged in — let other auth guards handle
        if (isPublicPath(pathname)) return; // don't redirect on public pages

        if (user.needsUsername) {
            router.replace("/onboarding/username");
        }
    }, [user, loading, pathname, router]);

    // While loading auth, render children normally
    // If user needs username and is not on public path, the redirect will happen
    return children;
}
