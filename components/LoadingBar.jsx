"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { loadingBar } from "@/lib/loadingBar";

export default function LoadingBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
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

    // Intercept anchor clicks to start the bar before navigation
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

    // Intercept programmatic navigation (router.push / router.replace)
    useEffect(() => {
        const origPush = router.push;
        const origReplace = router.replace;

        router.push = (...args) => {
            const target = typeof args[0] === "string" ? args[0] : "";
            if (target && target !== pathname) loadingBar.start();
            return origPush.apply(router, args);
        };
        router.replace = (...args) => {
            const target = typeof args[0] === "string" ? args[0] : "";
            if (target && target !== pathname) loadingBar.start();
            return origReplace.apply(router, args);
        };

        return () => {
            router.push = origPush;
            router.replace = origReplace;
        };
    }, [router, pathname]);

    // Listen for custom routeChangeStart events from any component
    useEffect(() => {
        const handler = () => loadingBar.start();
        window.addEventListener("routeChangeStart", handler);
        return () => window.removeEventListener("routeChangeStart", handler);
    }, []);

    return null;
}
