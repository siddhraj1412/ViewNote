"use client";

import { memo } from "react";

/**
 * Reusable 5-column grid component with responsive breakpoints
 * Desktop: 5 columns
 * Tablet: 3 columns
 * Mobile: 2 columns
 */
const MediaGrid = memo(function MediaGrid({ children, className = "" }) {
    return (
        <div
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${className}`}
        >
            {children}
        </div>
    );
});

export default MediaGrid;
