"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function OptimizedImage({
    src,
    alt,
    fill,
    className = "",
    priority = false,
    aspectRatio = "2/3",
    ...props
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        if (!fill && imgRef.current) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setIsLoading(false);
                        }
                    });
                },
                { rootMargin: "50px" }
            );

            observer.observe(imgRef.current);
            return () => observer.disconnect();
        }
    }, [fill]);

    return (
        <div
            ref={imgRef}
            className={`relative ${fill ? "" : "w-full"}`}
            style={!fill ? { aspectRatio } : undefined}
        >
            {isLoading && !priority && (
                <div className="absolute inset-0 bg-gradient-to-br from-secondary to-background animate-pulse" />
            )}
            <Image
                src={src}
                alt={alt}
                fill={fill}
                className={`${className} ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setError(true);
                    setIsLoading(false);
                }}
                loading={priority ? "eager" : "lazy"}
                quality={85}
                {...props}
            />
            {error && (
                <div className="absolute inset-0 bg-secondary flex items-center justify-center text-textSecondary text-sm">
                    Failed to load
                </div>
            )}
        </div>
    );
}
