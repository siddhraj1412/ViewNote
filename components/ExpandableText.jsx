"use client";

import { useState, useRef, useEffect } from "react";

/**
 * ExpandableText – truncates long text with a smooth expand/collapse toggle.
 *
 * @param {string}  text        – The full text to display
 * @param {number}  maxLines    – Number of visible lines before truncation (default 4)
 * @param {string}  className   – Additional tailwind classes for the text element
 */
export default function ExpandableText({ text, maxLines = 4, className = "" }) {
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);
    const textRef = useRef(null);

    // Detect whether the text actually overflows the clamp
    useEffect(() => {
        const el = textRef.current;
        if (!el) return;
        // Compare scrollHeight vs clientHeight to decide if we need the toggle
        const check = () => setClamped(el.scrollHeight > el.clientHeight + 2);
        check();
        // Re-check on resize
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, [text, maxLines]);

    if (!text) return null;

    return (
        <div>
            <p
                ref={textRef}
                className={`transition-all duration-300 ease-in-out ${className}`}
                style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: expanded ? "unset" : maxLines,
                    overflow: expanded ? "visible" : "hidden",
                }}
            >
                {text}
            </p>
            {(clamped || expanded) && (
                <button
                    onClick={() => setExpanded((prev) => !prev)}
                    className="mt-1.5 text-accent text-sm font-medium hover:underline focus:outline-none"
                >
                    {expanded ? "Read less" : "Read more"}
                </button>
            )}
        </div>
    );
}
