export const metadata = {
    title: "Terms of Service - ViewNote",
    description: "ViewNote Terms of Service - rules, responsibilities, and usage guidelines.",
};

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-background pt-24 pb-16">
            <div className="site-container max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-black mb-4">Terms of Service</h1>
                <p className="text-sm text-textSecondary mb-10">Last updated: February 16, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8 text-white/80 text-[15px] leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
                        <p className="text-textSecondary">
                            By accessing or using ViewNote, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Account Registration</h2>
                        <p className="text-textSecondary">
                            You must create an account to use most features. You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration. Each person may only maintain one account.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. User Responsibilities</h2>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-textSecondary">
                            <li>You are responsible for all content you create, including ratings, reviews, and lists.</li>
                            <li>You must not post content that is defamatory, hateful, threatening, or violates any applicable law.</li>
                            <li>You must not impersonate other users or public figures.</li>
                            <li>You must not use automated tools to scrape, spam, or overload the platform.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Content Guidelines</h2>
                        <p className="text-textSecondary">
                            Reviews and comments should be related to the media being discussed. Spoilers must be marked appropriately using the spoiler toggle. Content that violates these guidelines may be removed without notice.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Intellectual Property</h2>
                        <p className="text-textSecondary">
                            Movie and TV show metadata, images, and related content are provided by TMDB and are the property of their respective owners. Your reviews, ratings, and lists remain your intellectual property, but you grant ViewNote a non-exclusive license to display them on the platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Abuse Prevention</h2>
                        <p className="text-textSecondary">
                            Accounts that engage in abusive behavior may be suspended or terminated, including but not limited to: spamming, harassment, creating multiple accounts to manipulate ratings, or any activity that disrupts the platform&apos;s integrity.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Account Termination</h2>
                        <p className="text-textSecondary">
                            You may delete your account at any time from the Settings page. Accounts that violate these terms may be suspended or terminated. Upon termination, your data will be permanently deleted in accordance with the Privacy Policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Limitation of Liability</h2>
                        <p className="text-textSecondary">
                            ViewNote is provided &quot;as is&quot; without warranties of any kind. ViewNote is not liable for any damages arising from your use of the platform, including but not limited to: data loss, service interruptions, or inaccuracies in third-party data. Total liability shall not exceed the amount you have paid for the service (if any).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">9. Changes to Terms</h2>
                        <p className="text-textSecondary">
                            These terms may be updated from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms. Users will be notified of significant changes via email or platform notification.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
                        <p className="text-textSecondary">
                            If you have questions about these terms, reach out at{" "}
                            <a href="mailto:viewnote799@gmail.com" className="text-accent hover:underline">viewnote799@gmail.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
