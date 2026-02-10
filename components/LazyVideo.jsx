'use client';

import { useState } from 'react';
import LazyLoad from './LazyLoad';

/**
 * Lazy loading video player for trailers
 */
export default function LazyVideo({ videoKey, title, className = '' }) {
    const [isPlaying, setIsPlaying] = useState(false);

    const thumbnailUrl = `https://img.youtube.com/vi/${videoKey}/maxresdefault.jpg`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0`;

    return (
        <LazyLoad
            className={className}
            rootMargin="300px"
            placeholder={
                <div className="aspect-video bg-gray-800 animate-pulse rounded-lg" />
            }
        >
            {!isPlaying ? (
                <div
                    className="relative cursor-pointer group aspect-video rounded-lg overflow-hidden"
                    onClick={() => setIsPlaying(true)}
                >
                    <img
                        src={thumbnailUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg
                                className="w-8 h-8 text-white ml-1"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
            ) : (
                <iframe
                    className="w-full aspect-video rounded-lg"
                    src={embedUrl}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            )}
        </LazyLoad>
    );
}
