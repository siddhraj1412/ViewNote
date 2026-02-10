import dynamic from 'next/dynamic';

// Lazy load heavy components
export const LazyVideo = dynamic(() => import('./LazyVideo'), {
    loading: () => <div className="aspect-video bg-gray-800 animate-pulse rounded-lg" />,
    ssr: false,
});

export const LazyCastSlider = dynamic(() => import('./CastSlider'), {
    loading: () => <div className="h-48 bg-gray-800 animate-pulse rounded-lg" />,
});

export const LazyCrewSection = dynamic(() => import('./CrewSection'), {
    loading: () => <div className="h-64 bg-gray-800 animate-pulse rounded-lg" />,
});

export const LazyActionBar = dynamic(() => import('./ActionBar'), {
    loading: () => <div className="h-16 bg-gray-800 animate-pulse rounded-lg" />,
});

export const LazySearchOverlay = dynamic(() => import('./SearchOverlay'), {
    loading: () => null,
    ssr: false,
});
