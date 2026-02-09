"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * ScrollToTop component ensures that navigation to new routes
 * always starts at the top of the page, preventing the jarring
 * experience of landing mid-page.
 */
export default function ScrollToTop() {
    const pathname = usePathname();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}
