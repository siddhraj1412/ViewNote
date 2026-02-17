"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const CONTACT_EMAIL = "viewnote799@gmail.com";

const SECTIONS = [
    { id: "about", label: "What is ViewNote" },
    { id: "tracking", label: "Ways to Track" },
    { id: "ratings", label: "Ratings and Reviews" },
    { id: "favorites", label: "Favorites and Lists" },
    { id: "social", label: "Social Features" },
    { id: "profiles", label: "Profile and Statistics" },
    { id: "discovery", label: "Content Discovery" },
    { id: "episodes", label: "Upcoming Episodes and Next Up" },
    { id: "privacy", label: "Data and Privacy" },
    { id: "community", label: "Community Guidelines" },
    { id: "reporting", label: "Content Reporting" },
    { id: "private", label: "Private Accounts" },
    { id: "recap", label: "Yearly Recap" },
    { id: "roadmap", label: "Roadmap" },
    { id: "bugs", label: "How to Report Bugs" },
    { id: "contact", label: "Contact and Support" },
];

function AccordionItem({ id, title, isOpen, onToggle, children }) {
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/20">
            <button
                onClick={() => onToggle(id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left bg-secondary/50 hover:bg-secondary transition-colors"
            >
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <ChevronDown
                    size={20}
                    className={`text-textSecondary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
            >
                <div className="px-6 py-5 space-y-4 text-textSecondary leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function AboutContent() {
    const [openSection, setOpenSection] = useState("about");

    const handleToggle = (id) => {
        setOpenSection((prev) => (prev === id ? null : id));
    };

    return (
        <main className="min-h-screen bg-background pt-24 pb-16">
            <div className="site-container">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-3 text-white">About ViewNote</h1>
                    <p className="text-lg text-textSecondary mb-10">
                        Everything you need to know about the platform, its features, and how your data is handled.
                    </p>

                    <div className="space-y-3">
                        <AccordionItem id="about" title="What is ViewNote" isOpen={openSection === "about"} onToggle={handleToggle}>
                                <p>
                                    ViewNote is a personal media tracking platform designed for movie and television enthusiasts. It provides a comprehensive space to log, rate, review, and organize everything you watch. Whether you are a casual viewer or an avid cinephile, ViewNote helps you maintain a detailed record of your viewing habits and discover new content that matches your taste.
                                </p>
                                <p>
                                    The platform is built around the idea that tracking your media consumption should be simple, private, and distraction free. There are no advertisements, no algorithmically pushed sponsored content, and no paywalls. ViewNote is designed to be a straightforward tool that respects your time and attention.
                                </p>
                                <p>
                                    All movie and television data displayed on ViewNote is sourced from The Movie Database (TMDB). ViewNote uses the TMDB API but is not endorsed or certified by TMDB. Poster images, cast information, synopses, release dates, and other metadata are provided by TMDB and its community of contributors.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="tracking" title="Ways to Track" isOpen={openSection === "tracking"} onToggle={handleToggle}>
                                <p>
                                    ViewNote offers multiple tracking states so you can precisely categorize every title in your library. Each movie or series can be marked with one of the following statuses:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong className="text-white">Watched:</strong> Titles you have completed. Movies are marked as fully watched, while TV series tracking works at the episode, season, and series level. When all episodes in a season are marked watched, the season is automatically completed. When all seasons are completed, the series is marked as fully watched.</li>
                                    <li><strong className="text-white">Watching:</strong> Series you are currently following and actively viewing new episodes for.</li>
                                    <li><strong className="text-white">Watchlist:</strong> Titles you plan to watch in the future. Your watchlist serves as a personal queue of upcoming viewing.</li>
                                    <li><strong className="text-white">Paused:</strong> Series you have started but temporarily stopped watching. This helps you distinguish between active viewing and titles you intend to return to later.</li>
                                    <li><strong className="text-white">Dropped:</strong> Titles you started but decided not to finish. This status helps you remember what you have already tried so you do not accidentally start them again.</li>
                                </ul>
                                <p>
                                    These statuses transition automatically when appropriate. For example, adding a title to your watchlist will remove it from your dropped list if it was previously there. Marking a title as watched will remove it from your watchlist and watching list.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="ratings" title="Ratings and Reviews" isOpen={openSection === "ratings"} onToggle={handleToggle}>
                                <p>
                                    ViewNote uses a half star rating scale from 0.5 to 5 stars. You can rate movies, individual TV episodes, full seasons, and complete series. Your ratings are stored privately by default and contribute to your personal statistics and rating distribution graphs.
                                </p>
                                <p>
                                    The review system allows you to write detailed thoughts about any title. Reviews support spoiler tags so you can discuss plot details without ruining the experience for others. Other users can like and comment on your reviews, creating a space for meaningful discussion about the media you consume.
                                </p>
                                <p>
                                    Your personal rating distribution is visible on your profile page, showing a breakdown of how you rate across all media types. You can filter this data by movies only, shows only, seasons, or episodes to gain insights into your viewing preferences.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="favorites" title="Favorites and Lists" isOpen={openSection === "favorites"} onToggle={handleToggle}>
                                <p>
                                    The favorites system lets you highlight the titles that matter most to you. You can pin your favorite movies, TV shows, and individual episodes directly to your profile page. These favorites appear prominently on your profile and help visitors understand your taste at a glance.
                                </p>
                                <p>
                                    Custom lists provide a flexible way to organize titles into themed collections. You can create lists such as best films of a specific decade, comfort watches, or recommendations for friends. Lists can be reordered, edited, and shared with others.
                                </p>
                                <p>
                                    ViewNote also supports importing your existing media library from Letterboxd. If you have been tracking your viewing history on another platform, you can bring that data into ViewNote without starting from scratch. The import process preserves your ratings and watch dates.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="social" title="Social Features" isOpen={openSection === "social"} onToggle={handleToggle}>
                                <p>
                                    ViewNote includes a follow system that lets you connect with other users. You can follow other members to see their profiles, ratings, and reviews. The follow relationship is one directional, meaning you can follow someone without requiring them to follow you back.
                                </p>
                                <p>
                                    Your followers and following counts are displayed on your profile page with dedicated pages listing all connections. The follow system uses optimistic updates for a responsive user experience, meaning the interface reflects your action immediately while the server processes the request in the background.
                                </p>
                                <p>
                                    Social links can be added to your profile to connect your presence across platforms. ViewNote supports links to major platforms including Twitter, Instagram, Letterboxd, GitHub, YouTube, TikTok, and many others. Each linked platform is identified automatically with a recognizable icon.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="profiles" title="Profile and Statistics" isOpen={openSection === "profiles"} onToggle={handleToggle}>
                                <p>
                                    Every ViewNote user has a public profile page that displays their viewing activity. Your profile shows your display name, bio, avatar, banner image, social links, and location if you choose to share it. All of these elements are customizable through the settings page.
                                </p>
                                <p>
                                    Profile statistics provide a summary of your viewing habits including the total number of movies and shows you have watched, counts for the current year, and your follower and following numbers. These statistics update in real time as you log new activity.
                                </p>
                                <p>
                                    Your profile also features tabs for different activity views including your diary of recent watches and ratings, your reviews, your watchlist, your custom lists, your liked content, and titles you have paused or dropped. Each tab provides a detailed view of that particular aspect of your viewing history.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="discovery" title="Content Discovery" isOpen={openSection === "discovery"} onToggle={handleToggle}>
                                <p>
                                    The ViewNote homepage presents a curated selection of movies and TV shows designed to help you find your next watch. Content is organized into several sections including Featured Today, trending titles, fresh TV episodes, films currently in cinemas, popular picks, binge worthy series, upcoming releases, and hidden gems.
                                </p>
                                <p>
                                    The recommendation system prioritizes content you have not yet seen. If you are logged in, titles you have already watched, rated, or added to your favorites are automatically excluded from recommendations. This ensures that every visit to the homepage presents genuinely new suggestions.
                                </p>
                                <p>
                                    A rotation system tracks which titles have been displayed to you recently. Content you have seen in previous sessions enters a cooldown period before reappearing, which prevents the same recommendations from showing up repeatedly across multiple visits. When the pool of fresh content is exhausted, previously shown titles are gradually reintroduced.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="episodes" title="Upcoming Episodes and Next Up" isOpen={openSection === "episodes"} onToggle={handleToggle}>
                                <p>
                                    For TV series you are currently watching, ViewNote tracks episode level progress. The platform shows which episodes have aired recently and helps you keep track of where you left off. Season cards on show detail pages display your watch progress and personal ratings.
                                </p>
                                <p>
                                    The Fresh Episodes section on the homepage highlights shows that have aired new episodes within the past seven days. This section shows the episode name, season and episode number, and air date so you can quickly see what is new in the shows you follow.
                                </p>
                                <p>
                                    When you mark episodes as watched, ViewNote automatically updates your season and series progress. If all episodes in a season are marked as watched, the season is completed. If all seasons of a series are completed, the entire series is marked as watched and removed from your watching and watchlist queues.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="privacy" title="Data and Privacy" isOpen={openSection === "privacy"} onToggle={handleToggle}>
                                <p>
                                    ViewNote takes your privacy seriously. Your account data is stored securely using Supabase, which provides enterprise grade authentication and a PostgreSQL database. Your password is never stored in plain text and is handled entirely by Supabase Authentication with industry standard encryption.
                                </p>
                                <p>
                                    Your viewing data, ratings, reviews, and profile information are stored in a secure PostgreSQL database. This data is used solely to provide the ViewNote service and is never sold to third parties, used for advertising, or shared with external services beyond what is necessary for the platform to function.
                                </p>
                                <p>
                                    You have full control over your account. You can change your email address, update your password, and delete your account at any time through the settings page. Account deletion is permanent and removes all of your data from the platform including your profile, ratings, reviews, lists, and watch history. This action cannot be undone.
                                </p>
                                <p>
                                    ViewNote uses The Movie Database (TMDB) API to display media information. When you browse movies or TV shows, requests are made to the TMDB API to retrieve metadata. No personal information is sent to TMDB as part of these requests.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="community" title="Community Guidelines" isOpen={openSection === "community"} onToggle={handleToggle}>
                                <p>
                                    ViewNote is a community built around a shared appreciation for film and television. All members are expected to engage respectfully and constructively. The following guidelines apply to all user generated content on the platform including reviews, comments, profile bios, and list descriptions.
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Treat other users with respect. Personal attacks, harassment, and bullying are not tolerated.</li>
                                    <li>Reviews should discuss the media itself. Off topic content, spam, and promotional material will be removed.</li>
                                    <li>Use spoiler tags appropriately. When discussing plot details in reviews, mark them as containing spoilers so other users can choose whether to read them.</li>
                                    <li>Do not post content that is hateful, discriminatory, or harmful toward any group of people.</li>
                                    <li>Do not impersonate other users or public figures.</li>
                                    <li>Do not use the platform to distribute pirated content or link to unauthorized streaming sources.</li>
                                </ul>
                                <p>
                                    Violations of these guidelines may result in content removal or account suspension depending on the severity and frequency of the behavior.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="reporting" title="Content Reporting" isOpen={openSection === "reporting"} onToggle={handleToggle}>
                                <p>
                                    If you encounter content that violates the community guidelines, you can report it for review. Reports are handled confidentially. When submitting a report, please provide as much context as possible to help understand the issue.
                                </p>
                                <p>
                                    To report a review, comment, or profile that you believe violates the guidelines, reach out directly at{" "}
                                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">{CONTACT_EMAIL}</a>.
                                    Include the username of the account in question and a description of the content you are reporting.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="private" title="Private Accounts" isOpen={openSection === "private"} onToggle={handleToggle}>
                                <p>
                                    ViewNote profiles are public by default, meaning anyone can view your profile page, ratings, reviews, and viewing activity. Private account functionality is planned for a future release and will allow you to restrict who can see your activity.
                                </p>
                                <p>
                                    When private accounts are available, you will be able to control the visibility of your profile, ratings, and reviews. Followers will need your approval before they can see your private content. Your public profile will display only your name and avatar without any viewing details.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="recap" title="Yearly Recap" isOpen={openSection === "recap"} onToggle={handleToggle}>
                                <p>
                                    ViewNote provides yearly diary pages that let you look back at everything you watched and rated during a specific year. These pages are accessible from your profile and show a chronological list of all your ratings organized by month with poster thumbnails, star ratings, and liked indicators.
                                </p>
                                <p>
                                    Yearly recaps are available for both movies and TV shows separately. You can view past years to see how your viewing habits and preferences have evolved over time. The data for these recaps is generated from your rating history and watch dates, so accurate date logging helps produce a more complete picture of each year.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="roadmap" title="Roadmap" isOpen={openSection === "roadmap"} onToggle={handleToggle}>
                                <p>
                                    ViewNote is under active development and new features are being planned and built continuously. The following areas are currently being worked on or are planned for future releases:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Activity feed showing recent activity from users you follow.</li>
                                    <li>Private accounts with follower approval workflows.</li>
                                    <li>Enhanced recommendation algorithms based on your rating history and preferences.</li>
                                    <li>Multi language support for the interface and content metadata.</li>
                                    <li>Mobile application development for iOS and Android platforms.</li>
                                    <li>Advanced statistics and analytics dashboards with deeper insights into viewing patterns.</li>
                                    <li>Notification system for new episodes of shows you are watching and interactions with your reviews.</li>
                                </ul>
                                <p>
                                    Feature requests and suggestions are welcome. If there is something you would like to see added to the platform, please reach out using the contact information below.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="bugs" title="How to Report Bugs" isOpen={openSection === "bugs"} onToggle={handleToggle}>
                                <p>
                                    If you encounter a bug or something that does not work as expected, please report it so it can be investigated and fixed. When reporting a bug, providing detailed information significantly speeds up the resolution process.
                                </p>
                                <p>
                                    A helpful bug report includes the following details when possible: a description of what happened, what you expected to happen instead, the steps you took before the issue occurred, the browser and device you were using, and any error messages that appeared on screen.
                                </p>
                                <p>
                                    Bug reports can be submitted via email to{" "}
                                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">{CONTACT_EMAIL}</a>.
                                    Please include the word Bug in the subject line so the report can be prioritized appropriately.
                                </p>
                        </AccordionItem>

                        <AccordionItem id="contact" title="Contact and Support" isOpen={openSection === "contact"} onToggle={handleToggle}>
                                <p>
                                    For general inquiries, feedback, feature requests, bug reports, or any other communication, you can reach me at the following email address:
                                </p>
                                <div className="bg-secondary rounded-xl p-4 border border-white/5 mt-2">
                                    <p className="text-white font-medium">
                                        <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">{CONTACT_EMAIL}</a>
                                    </p>
                                </div>
                                <p className="mt-4">
                                    Response times may vary depending on volume, but I aim to respond to all inquiries within a reasonable timeframe. When reaching out, please be as specific as possible about your question or issue so I can provide the most helpful response.
                                </p>
                        </AccordionItem>
                    </div>

                    {/* TMDB Attribution */}
                    <div className="bg-secondary rounded-2xl p-6 border border-white/5 mt-8">
                        <p className="text-sm text-textSecondary">
                            This product uses the{" "}
                            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">TMDB</a>{" "}
                            API but is not endorsed or certified by TMDB. All movie and TV data is provided by The Movie Database.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
