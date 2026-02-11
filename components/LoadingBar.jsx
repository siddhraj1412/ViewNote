"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { loadingBar } from "@/lib/loadingBar";

export default function LoadingBar() {
    const pathname = usePathname();

    useEffect(() => {
        // Start loading on route change
        loadingBar.start();

        // Complete loading after a short delay to ensure page is ready
        const timer = setTimeout(() => {
            loadingBar.done();
        }, 300);

        return () => {
            clearTimeout(timer);
            loadingBar.forceDone();
        };
    }, [pathname]);

    return null; // This component doesn't render anything
}
