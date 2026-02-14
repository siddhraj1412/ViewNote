import Link from "next/link";
import { Film } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="site-container text-center py-12">
                <Film className="mx-auto mb-6 text-accent" size={80} />
                <h1 className="text-6xl font-black mb-4">404</h1>
                <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
                <p className="text-textSecondary mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/"
                    className="inline-block bg-accent text-background px-8 py-3 rounded-xl font-bold hover:bg-opacity-90 transition"
                >
                    Go Home
                </Link>
            </div>
        </div>
    );
}
