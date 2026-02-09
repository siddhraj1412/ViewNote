export default function SkeletonLoader() {
    return (
        <div className="animate-pulse">
            <div className="bg-secondary rounded-xl h-full"></div>
        </div>
    );
}

export function MovieCardSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="bg-secondary rounded-xl aspect-[2/3] mb-3"></div>
            <div className="bg-secondary h-4 rounded mb-2"></div>
            <div className="bg-secondary h-3 rounded w-2/3"></div>
        </div>
    );
}

export function MovieHeroSkeleton() {
    return (
        <div className="relative h-[70vh] bg-secondary animate-pulse">
            <div className="absolute bottom-16 left-4 right-4">
                <div className="bg-background h-12 rounded mb-4 max-w-2xl"></div>
                <div className="bg-background h-6 rounded mb-6 max-w-xl"></div>
                <div className="flex gap-4">
                    <div className="bg-background h-12 w-32 rounded"></div>
                    <div className="bg-background h-12 w-32 rounded"></div>
                </div>
            </div>
        </div>
    );
}
