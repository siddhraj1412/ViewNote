export const metadata = {
    title: "Privacy Policy - ViewNote",
    description: "ViewNote Privacy Policy — how your data is collected, used, and protected.",
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-background pt-24 pb-16">
            <div className="site-container max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-black mb-4">Privacy Policy</h1>
                <p className="text-sm text-textSecondary mb-10">Last updated: February 16, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8 text-white/80 text-[15px] leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Information Collected</h2>
                        <p>When you create an account, the following information is collected:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-textSecondary">
                            <li><strong className="text-white/80">Account data:</strong> Email address, display name, username, and profile picture.</li>
                            <li><strong className="text-white/80">Activity data:</strong> Ratings, reviews, watchlist entries, watch history, favorites, and custom lists you create.</li>
                            <li><strong className="text-white/80">Import data:</strong> If you import from Letterboxd or other services, we process the uploaded file to extract your media history.</li>
                            <li><strong className="text-white/80">Usage data:</strong> Basic analytics such as page views and feature usage.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Authentication</h2>
                        <p className="text-textSecondary">
                            ViewNote uses Supabase Authentication to manage user accounts. You can sign up with email/password or Google Sign-In. Your password is not stored directly — authentication is handled securely by the infrastructure. When using Google Sign-In, your name, email, and profile photo are received from Google.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Data Storage</h2>
                        <p className="text-textSecondary">
                            Your data is stored in Supabase (PostgreSQL) and Supabase Storage. All data is transmitted over HTTPS. Profile pictures and import files are stored in Supabase Storage with access controls. Your data is retained for as long as your account is active.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Cookies & Local Storage</h2>
                        <p className="text-textSecondary">
                            Browser local storage and session storage are used to cache homepage content, remember your preferences, and maintain your authentication session. No third-party tracking cookies are used. Firebase Analytics may set its own cookies for anonymous usage statistics.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-textSecondary">
                            <li><strong className="text-white/80">TMDB (The Movie Database):</strong> The TMDB API is used to fetch movie, TV show, and person metadata. Your searches and browsing activity are sent to TMDB as API requests.</li>
                            <li><strong className="text-white/80">Firebase (Google):</strong> Authentication, database, storage, and analytics.</li>
                            <li><strong className="text-white/80">Vercel:</strong> Hosting and deployment infrastructure.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Data Sharing</h2>
                        <p className="text-textSecondary">
                            Your personal data is not sold, rented, or shared with third parties for marketing purposes. Data is only shared with the third-party services listed above as necessary to provide the platform&apos;s functionality.
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
                            If you have questions about this privacy policy, reach out at{" "}
                            <a href="mailto:viewnote799@gmail.com" className="text-accent hover:underline">viewnote799@gmail.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
