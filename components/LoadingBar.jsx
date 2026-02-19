"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { loadingBar } from "@/lib/loadingBar";

export default function LoadingBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const isFirst = useRef(true);
    const prevUrl = useRef("");

    // Build current full URL for comparison
    const currentUrl = pathname + (searchParams?.toString() ? `?${searchParams}` : "");

    useEffect(() => {
        // On first mount, just force-complete any stale bar
        if (isFirst.current) {
            isFirst.current = false;
            prevUrl.current = currentUrl;
            loadingBar.forceDone();
            return;
        }
        // Route changed — complete the loading bar
        prevUrl.current = currentUrl;
        loadingBar.done();
    }, [currentUrl]);

    // Intercept anchor clicks to start the bar before navigation
    useEffect(() => {
        const handleClick = (e) => {
            const anchor = e.target.closest("a[href]");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("http") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                anchor.target === "_blank" ||
                anchor.hasAttribute("download") ||
                e.ctrlKey || e.metaKey || e.shiftKey // new tab clicks
            ) return;

            // Don't start if navigating to the exact same URL (including search params)
            const hrefPath = href.split("?")[0].split("#")[0];
            const currentPath = pathname;
            if (href === currentUrl || hrefPath === currentPath) return;

            loadingBar.start();
        };
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [pathname, currentUrl]);

    // Intercept programmatic navigation (router.push / router.replace)
    useEffect(() => {
        const origPush = router.push;
        const origReplace = router.replace;

        router.push = (...args) => {
            const target = typeof args[0] === "string" ? args[0] : "";
            if (target && target !== currentUrl && target !== pathname) {
                loadingBar.start();
            }
            return origPush.apply(router, args);
        };
        router.replace = (...args) => {
            const target = typeof args[0] === "string" ? args[0] : "";
            if (target && target !== currentUrl && target !== pathname) {
                loadingBar.start();
            }
            return origReplace.apply(router, args);
        };

        return () => {
            router.push = origPush;
            router.replace = origReplace;
        };
    }, [router, pathname, currentUrl]);

    // Listen for custom routeChangeStart events from any component
    useEffect(() => {
        const handler = () => loadingBar.start();
        window.addEventListener("routeChangeStart", handler);
        return () => window.removeEventListener("routeChangeStart", handler);
    }, []);

    return null;
}
