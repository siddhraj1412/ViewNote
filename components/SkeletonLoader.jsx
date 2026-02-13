/**
 * Skeleton loader components with explicit dimensions to prevent CLS
 */

export function PosterSkeleton({ className = '' }) {
    return (
        <div
            className={`bg-gray-800 animate-pulse rounded-lg ${className}`}
            style={{ aspectRatio: '2/3', minHeight: '300px' }}
        />
    );
}

export function BannerSkeleton({ className = '' }) {
    return (
        <div
            className={`bg-gray-800 animate-pulse rounded-lg ${className}`}
            style={{ aspectRatio: '16/9', minHeight: '400px' }}
        />
    );
}

export function CardSkeleton({ className = '' }) {
    return (
        <div className={`space-y-3 ${className}`}>
            <div
                className="bg-gray-800 animate-pulse rounded-lg"
                style={{ aspectRatio: '2/3', minHeight: '200px' }}
            />
            <div className="h-4 bg-gray-800 animate-pulse rounded w-3/4" />
            <div className="h-3 bg-gray-800 animate-pulse rounded w-1/2" />
        </div>
    );
}

export function TextSkeleton({ lines = 3, className = '' }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="h-4 bg-gray-800 animate-pulse rounded"
                    style={{
                        width: i === lines - 1 ? '60%' : '100%',
                    }}
                />
            ))}
        </div>
    );
}

export function MovieCardSkeleton({ className = '' }) {
    return (
        <div className={`space-y-3 ${className}`}>
            <div
                className="bg-gray-800 animate-pulse rounded-2xl"
                style={{ aspectRatio: '2/3', minHeight: '260px' }}
            />
            <div className="h-4 bg-gray-800 animate-pulse rounded w-3/4" />
            <div className="h-3 bg-gray-800 animate-pulse rounded w-1/2" />
        </div>
    );
}

export function DetailPageSkeleton() {
    return (
        <div className="min-h-screen">
            {/* Banner Skeleton */}
            <BannerSkeleton className="w-full" />

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Poster Skeleton */}
                    <div className="md:col-span-1">
                        <PosterSkeleton />
                    </div>

                    {/* Details Skeleton */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="h-8 bg-gray-800 animate-pulse rounded w-3/4" />
                        <TextSkeleton lines={4} />
                        <div className="flex gap-4">
                            <div className="h-10 w-32 bg-gray-800 animate-pulse rounded" />
                            <div className="h-10 w-32 bg-gray-800 animate-pulse rounded" />
                        </div>
                    </div>
                </div>

                {/* Cast Skeleton */}
                <div className="mt-12">
                    <div className="h-6 bg-gray-800 animate-pulse rounded w-32 mb-4" />
                    <div className="flex gap-4 overflow-hidden">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-32">
                                <div
                                    className="bg-gray-800 animate-pulse rounded-lg mb-2"
                                    style={{ aspectRatio: '2/3', height: '192px' }}
                                />
                                <div className="h-3 bg-gray-800 animate-pulse rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
