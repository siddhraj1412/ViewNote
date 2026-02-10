'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Lazy load wrapper component with Intersection Observer
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to lazy load
 * @param {string} props.className - Optional className
 * @param {number} props.threshold - Intersection threshold (0-1)
 * @param {string} props.rootMargin - Root margin for early loading
 * @param {React.ReactNode} props.placeholder - Placeholder while loading
 */
export default function LazyLoad({
    children,
    className = '',
    threshold = 0.1,
    rootMargin = '200px',
    placeholder = null,
}) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    // Once visible, stop observing
                    if (ref.current) {
                        observer.unobserve(ref.current);
                    }
                }
            },
            {
                threshold,
                rootMargin,
            }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, [threshold, rootMargin]);

    return (
        <div ref={ref} className={className}>
            {isVisible ? children : placeholder}
        </div>
    );
}
