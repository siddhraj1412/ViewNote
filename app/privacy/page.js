export const metadata = {
    title: "Privacy Policy - ViewNote",
    description: "ViewNote Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-background pt-24 pb-16">
            <div className="site-container max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-black mb-4">Privacy Policy</h1>
                <p className="text-sm text-textSecondary mb-10">Last updated: February 16, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8 text-white/80 text-[15px] leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
                        <p>When you create an account, we collect:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-textSecondary">
                            <li><strong className="text-white/80">Account data:</strong> Email address, display name, username, and profile picture.</li>
                            <li><strong className="text-white/80">Activity data:</strong> Ratings, reviews, watchlist entries, watch history, favorites, and custom lists you create.</li>
                            <li><strong className="text-white/80">Import data:</strong> If you import from Letterboxd or other services, we process the uploaded file to extract your media history.</li>
                            <li><strong className="text-white/80">Usage data:</strong> Basic analytics such as page views and feature usage, collected via Firebase Analytics.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Authentication</h2>
                        <p className="text-textSecondary">
                            We use Firebase Authentication to manage user accounts. You can sign up with email/password or Google Sign-In. We do not store your password directly — Firebase handles authentication securely. When using Google Sign-In, we receive your name, email, and profile photo from Google.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Data Storage</h2>
                        <p className="text-textSecondary">
                            Your data is stored in Google Cloud Firestore and Firebase Storage. All data is transmitted over HTTPS. Profile pictures and import files are stored in Firebase Storage with access controls. We retain your data for as long as your account is active.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Cookies & Local Storage</h2>
                        <p className="text-textSecondary">
                            We use browser local storage and session storage to cache homepage content, remember your preferences, and maintain your authentication session. We do not use third-party tracking cookies. Firebase Analytics may set its own cookies for anonymous usage statistics.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-textSecondary">
                            <li><strong className="text-white/80">TMDB (The Movie Database):</strong> We use the TMDB API to fetch movie, TV show, and person metadata. Your searches and browsing activity are sent to TMDB as API requests.</li>
                            <li><strong className="text-white/80">Firebase (Google):</strong> Authentication, database, storage, and analytics.</li>
                            <li><strong className="text-white/80">Vercel:</strong> Hosting and deployment infrastructure.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Data Sharing</h2>
                        <p className="text-textSecondary">
                            We do not sell, rent, or share your personal data with third parties for marketing purposes. Your data is only shared with the third-party services listed above as necessary to provide the platform&apos;s functionality.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Your Rights</h2>
                        <p className="text-textSecondary">
                            You can export your data, update your profile information, or delete your account at any time from the Settings page. Deleting your account permanently removes all your data from our systems.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
                        <p className="text-textSecondary">
                            If you have questions about this privacy policy, contact us at{" "}
                            <a href="mailto:viewnote799@gmail.com" className="text-accent hover:underline">viewnote799@gmail.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
