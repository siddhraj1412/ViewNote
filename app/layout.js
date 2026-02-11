import "./globals.css";
import "../styles/nprogress.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/Navbar";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingBar from "@/components/LoadingBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "ViewNote - Discover, Rate & Share Movies & TV Shows",
    description:
        "Your personal movie and TV show discovery platform. Rate, review, and share your favorite entertainment.",
    keywords: [
        "movies",
        "tv shows",
        "ratings",
        "reviews",
        "entertainment",
        "discovery",
    ],
    openGraph: {
        title: "ViewNote",
        description: "Discover, Rate & Share Movies & TV Shows",
        type: "website",
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ErrorBoundary>
                    <AuthProvider>
                        <Toaster
                            position="bottom-right"
                            toastOptions={{
                                duration: 3000,
                                style: {
                                    background: "rgba(26, 29, 36, 0.95)",
                                    color: "#fff",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    backdropFilter: "blur(12px)",
                                    borderRadius: "12px",
                                    fontSize: "14px",
                                },
                                success: {
                                    iconTheme: {
                                        primary: "#4169E1",
                                        secondary: "#fff",
                                    },
                                },
                                error: {
                                    iconTheme: {
                                        primary: "#FF5C5C",
                                        secondary: "#fff",
                                    },
                                },
                            }}
                        />
                        <LoadingBar />
                        <ScrollToTop />
                        <Navbar />
                        {children}
                    </AuthProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
