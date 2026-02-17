import Link from "next/link";

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-white/10 bg-background">
            <div className="site-container py-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-5 space-y-3">
                        <div className="text-lg font-bold text-white">ViewNote</div>
                        <div className="text-sm text-textSecondary">Track. Rate. Review.</div>
                        <div className="text-sm text-textSecondary">Built for film lovers.</div>
                        <div className="text-xs text-textSecondary/70">v1.0</div>
                    </div>

                    <div className="md:col-span-4">
                        <div className="text-sm font-semibold text-white mb-3">Links</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <Link href="/about" className="text-textSecondary hover:text-white transition-colors">About</Link>
                            <Link href="/contact" className="text-textSecondary hover:text-white transition-colors">Contact</Link>
                            <Link href="/privacy" className="text-textSecondary hover:text-white transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="text-textSecondary hover:text-white transition-colors">Terms</Link>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <div className="text-sm font-semibold text-white mb-3">Contact</div>
                        <a href="mailto:viewnote799@gmail.com" className="text-sm text-textSecondary hover:text-accent transition-colors block mb-2">
                            viewnote799@gmail.com
                        </a>
                        <a
                            href="https://buymeacoffee.com/viewnote"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-textSecondary hover:text-accent transition-colors"
                        >
                            ☕ Buy Me a Coffee
                        </a>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-white/10 space-y-2">
                    <div className="text-xs text-textSecondary">Data provided by TMDB.</div>
                    <div className="text-xs text-textSecondary/70">
                        This product uses the <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">TMDB</a> API but is not endorsed or certified by TMDB.
                    </div>
                    <div className="text-xs text-textSecondary/70">&copy; {year} ViewNote. All rights reserved.</div>
                </div>
            </div>
        </footer>
    );
}
