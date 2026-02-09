import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import Navbar from "@/components/Navbar";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "ViewNote - Watch blind. Rate honestly.",
    description: "A spoiler-free movie and series tracking platform",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
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
