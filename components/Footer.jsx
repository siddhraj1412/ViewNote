import Link from "next/link";
import { Github, Twitter, Linkedin } from "lucide-react";

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
                        <div className="text-sm font-semibold text-white mb-3">Social</div>
                        <div className="flex items-center gap-3">
                            <a href="#" className="p-2 rounded-lg bg-white/5 border border-white/10 text-textSecondary hover:text-white hover:bg-white/10 transition-colors" aria-label="GitHub">
                                <Github size={16} />
                            </a>
                            <a href="#" className="p-2 rounded-lg bg-white/5 border border-white/10 text-textSecondary hover:text-white hover:bg-white/10 transition-colors" aria-label="Twitter">
                                <Twitter size={16} />
                            </a>
                            <a href="#" className="p-2 rounded-lg bg-white/5 border border-white/10 text-textSecondary hover:text-white hover:bg-white/10 transition-colors" aria-label="LinkedIn">
                                <Linkedin size={16} />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-white/10 space-y-2">
                    <div className="text-xs text-textSecondary">Data provided by TMDB.</div>
                    <div className="text-xs text-textSecondary/70">
                        This product uses the <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">TMDB</a> API but is not endorsed or certified by TMDB.
                    </div>
                    <div className="text-xs text-textSecondary/70">© {year} ViewNote. All rights reserved.</div>
                </div>
            </div>
        </footer>
    );
}
