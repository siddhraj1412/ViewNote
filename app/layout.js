import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import Navbar from "@/components/Navbar";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";

// Optimize font loading with display swap
const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    preload: true,
    fallback: ["system-ui", "arial"],
});

export const metadata = {
    title: "ViewNote - Watch blind. Rate honestly.",
    description: "A spoiler-free movie and series tracking platform",
    keywords: ["movies", "tv shows", "tracking", "ratings", "spoiler-free"],
    authors: [{ name: "ViewNote" }],
    viewport: {
        width: "device-width",
        initialScale: 1,
        maximumScale: 5,
    },
    themeColor: "#000000",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                {/* Preconnect to external domains for faster loading */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link rel="preconnect" href="https://image.tmdb.org" />
                <link rel="dns-prefetch" href="https://api.themoviedb.org" />
                <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
            </head>
            <body className={inter.className}>
                <ErrorBoundary>
                    <AuthProvider>
                        <ToastProvider>
                            <ScrollToTop />
                            <Navbar />
                            {children}
                        </ToastProvider>
                    </AuthProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
