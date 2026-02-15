"use client";

import dynamic from "next/dynamic";

const FeatureDebugPanel = dynamic(() => import("@/components/FeatureDebugPanel"), {
    ssr: false,
    loading: () => null,
});

export default function DebugPanelWrapper() {
    if (process.env.NODE_ENV !== "development") return null;
    return <FeatureDebugPanel />;
}
