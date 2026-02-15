"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { loadingBar } from "@/lib/loadingBar";

export default function LoadingBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isFirst = useRef(true);

    useEffect(() => {
        // On first mount, just force-complete any stale bar
        if (isFirst.current) {
            isFirst.current = false;
            loadingBar.forceDone();
            return;
        }
        // Route changed — complete the loading bar
        loadingBar.done();
    }, [pathname, searchParams]);

    // Intercept link clicks to start the bar before navigation
    useEffect(() => {
        const handleClick = (e) => {
            const anchor = e.target.closest("a[href]");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || anchor.target === "_blank") return;
            // Don't start if navigating to same page
            if (href === pathname) return;
            loadingBar.start();
        };
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [pathname]);

    return null;
}
