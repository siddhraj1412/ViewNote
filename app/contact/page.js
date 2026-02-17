import { Mail, MessageSquare } from "lucide-react";

export const metadata = {
    title: "Contact - ViewNote",
    description: "Get in touch for feedback, bug reports, or support.",
};

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-background pt-24 pb-16">
            <div className="site-container max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-black mb-4">Contact</h1>
                <p className="text-lg text-textSecondary mb-12">
                    For feedback, bug reports, or support, feel free to reach out anytime.
                </p>

                <div className="bg-secondary rounded-2xl p-6 md:p-8 border border-white/5 space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <Mail size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold mb-1">Email</h2>
                            <a
                                href="mailto:viewnote799@gmail.com"
                                className="text-accent hover:underline text-lg"
                            >
                                viewnote799@gmail.com
                            </a>
                            <p className="text-sm text-textSecondary mt-2">
                                I typically respond within 24–48 hours.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <MessageSquare size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold mb-1">What to Include</h2>
                            <ul className="text-textSecondary text-sm space-y-1 list-disc list-inside">
                                <li>A clear description of the issue or feedback</li>
                                <li>Steps to reproduce (for bug reports)</li>
                                <li>Your browser and device info if relevant</li>
                                <li>Screenshots if applicable</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-sm text-textSecondary">
                        I value every message. Whether it&apos;s a feature request, a bug you encountered, or just a kind word — I appreciate you taking the time to reach out.
                    </p>
                </div>
            </div>
        </main>
    );
}
