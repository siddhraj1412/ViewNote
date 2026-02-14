"use client";

import { useEffect } from "react";
import { loadingBar } from "@/lib/loadingBar";

export default function LoadingBar() {
    useEffect(() => {
        loadingBar.forceDone();
    }, []);

    return null; // This component doesn't render anything
}
