import AboutContent from "./AboutContent";

export const metadata = {
    title: "About - ViewNote",
    description:
        "Learn about ViewNote, a personal media tracking platform for movies and TV shows. Discover features, privacy practices, community guidelines, and more.",
    openGraph: {
        title: "About ViewNote",
        description: "Your personal movie and TV show tracking, rating, and review platform.",
        type: "website",
    },
};

export default function AboutPage() {
    return <AboutContent />;
}
