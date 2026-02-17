import Link from "next/link";

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-white/10 bg-background">
            <div className="site-container py-10">
                {/* Beta Notice */}
                <div className="mb-8 px-4 py-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-textSecondary">
                    <span className="font-semibold text-accent">Beta</span>{" "}
                    — ViewNote is still in beta. Some features may be incomplete or change. I appreciate your patience and feedback.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-5 space-y-3">
                        <div className="text-lg font-bold text-white">ViewNote</div>
                        <p className="text-sm text-textSecondary leading-relaxed max-w-xs">
                            Your personal space to track, rate, and review movies and TV shows. Built for film lovers.
                        </p>
                    </div>

                    <div className="md:col-span-4">
                        <div className="text-sm font-semibold text-white mb-3">Quick Links</div>
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                            <Link href="/about" className="text-textSecondary hover:text-white transition-colors">About</Link>
                            <Link href="/contact" className="text-textSecondary hover:text-white transition-colors">Contact</Link>
                            <Link href="/privacy" className="text-textSecondary hover:text-white transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="text-textSecondary hover:text-white transition-colors">Terms of Service</Link>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <div className="text-sm font-semibold text-white mb-3">Get in Touch</div>
                        <a href="mailto:viewnote799@gmail.com" className="text-sm text-textSecondary hover:text-accent transition-colors block mb-3">
                            viewnote799@gmail.com
                        </a>
                        <a
                            href="https://buymeacoffee.com/siddhrajthakor"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-textSecondary hover:text-accent transition-colors"
                        >
                            ☕ Buy Me a Coffee
                        </a>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-textSecondary/70">
                        &copy; {year} ViewNote. All rights reserved.
                    </div>
                    <div className="text-xs text-textSecondary/70">
                        Data provided by{" "}
                        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">TMDB</a>.
                        Not endorsed or certified by TMDB.
                    </div>
                </div>
            </div>
        </footer>
    );
}
