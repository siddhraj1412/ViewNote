'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * Optimized image component with aspect ratio container to prevent CLS
 * @param {Object} props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Alt text
 * @param {number} props.width - Image width
 * @param {number} props.height - Image height
 * @param {string} props.className - Optional className
 * @param {string} props.fallback - Fallback image URL
 * @param {string} props.priority - Priority loading
 * @param {string} props.sizes - Responsive sizes
 */
export default function OptimizedImage({
    src,
    alt,
    width,
    height,
    className = '',
    fallback = '/placeholder-poster.svg',
    priority = false,
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}) {
    const [imgSrc, setImgSrc] = useState(src || fallback);
    const [isLoading, setIsLoading] = useState(true);

    const aspectRatio = height && width ? (height / width) * 100 : 150;

    return (
        <div
            className={`relative overflow-hidden ${className}`}
            style={{ paddingBottom: `${aspectRatio}%` }}
        >
            <Image
                src={imgSrc}
                alt={alt}
                fill
                sizes={sizes}
                priority={priority}
                className={`object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                onLoadingComplete={() => setIsLoading(false)}
                onError={() => {
                    setImgSrc(fallback);
                    setIsLoading(false);
                }}
            />
            {isLoading && (
                <div className="absolute inset-0 bg-gray-800 animate-pulse" />
            )}
        </div>
    );
}
