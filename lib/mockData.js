export const mockMovies = [
    {
        id: 550,
        title: "Fight Club",
        overview: "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy. Their concept catches on, with underground \"fight clubs\" forming in every town, until an eccentric gets in the way and ignites an out-of-control spiral toward oblivion.",
        poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        backdrop_path: "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",
        release_date: "1999-10-15",
        vote_average: 8.4,
        popularity: 60.2,
        media_type: "movie",
        genres: [{ id: 18, name: "Drama" }]
    },
    {
        id: 27205,
        title: "Inception",
        overview: "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: \"inception\", the implantation of another person's idea into a target's subconscious.",
        poster_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        backdrop_path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
        release_date: "2010-07-15",
        vote_average: 8.3,
        popularity: 50.5,
        media_type: "movie",
        genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }]
    },
    {
        id: 157336,
        title: "Interstellar",
        overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
        poster_path: "/gEU2QniL6E77NI6lCU6MxlNBvIx.jpg",
        backdrop_path: "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg",
        release_date: "2014-11-05",
        vote_average: 8.4,
        popularity: 140.2,
        media_type: "movie",
        genres: [{ id: 12, name: "Adventure" }, { id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }]
    },
    {
        id: 155,
        title: "The Dark Knight",
        overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.",
        poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        backdrop_path: "/1TjvGVD9qaCarp5U0FQuUx2NmMz.jpg",
        release_date: "2008-07-16",
        vote_average: 8.5,
        popularity: 85.3,
        media_type: "movie",
        genres: [{ id: 18, name: "Drama" }, { id: 28, name: "Action" }, { id: 80, name: "Crime" }, { id: 53, name: "Thriller" }]
    },
    {
        id: 19995,
        title: "Avatar",
        overview: "In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission, but becomes torn between following orders and protecting an alien civilization.",
        poster_path: "/kyeqWdyUXW608qlYkRqosgbbJyK.jpg",
        backdrop_path: "/vL5LR6WdxWPjLPFRLe133jX9UAy.jpg",
        release_date: "2009-12-15",
        vote_average: 7.5,
        popularity: 100.2,
        media_type: "movie",
        genres: [{ id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 14, name: "Fantasy" }, { id: 878, name: "Science Fiction" }]
    }
];

export const mockTV = [
    {
        id: 1399,
        name: "Game of Thrones",
        overview: "Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north. Amidst the war, a neglected military order of misfits, the Night's Watch, is all that stands between the realms of men and the icy horrors beyond.",
        poster_path: "/1XS1qyL1tl6eZAgE0DDxl5AmsMz.jpg",
        backdrop_path: "/suopoADq0k8diQmGXqYa77XLlDq.jpg",
        first_air_date: "2011-04-17",
        vote_average: 8.4,
        popularity: 350.2,
        media_type: "tv",
        genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }, { id: 18, name: "Drama" }, { id: 10759, name: "Action & Adventure" }]
    },
    {
        id: 66732,
        name: "Stranger Things",
        overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
        poster_path: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
        backdrop_path: "/56v2KjBlU4XaOv9rVYkJu64COcfe.jpg",
        first_air_date: "2016-07-15",
        vote_average: 8.6,
        popularity: 200.5,
        media_type: "tv",
        genres: [{ id: 18, name: "Drama" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 9648, name: "Mystery" }]
    }
];

export const mockDetails = {
    ...mockMovies[0],
    credits: {
        cast: [
            { id: 819, name: "Edward Norton", character: "The Narrator", profile_path: "/eIkFHNlfretLS1spAcIoihKUS62.jpg" },
            { id: 287, name: "Brad Pitt", character: "Tyler Durden", profile_path: "/cckcYc2v0yh1tc9QjRelptcOBko.jpg" },
            { id: 1283, name: "Helena Bonham Carter", character: "Marla Singer", profile_path: "/mW1NolxCnMw1ntDv6jcfCbUoogP.jpg" }
        ],
        crew: [
            { id: 7467, name: "David Fincher", job: "Director", department: "Directing", profile_path: "/t7dF9uPe5fb4gQEq8vK6Y3e0Z1r.jpg" }
        ]
    },
    similar: { results: mockMovies.slice(1, 4) },
    videos: { results: [{ key: "BdJKm16Co6M", site: "YouTube", type: "Trailer" }] }
};

export const getMockData = (endpoint) => {
    if (endpoint.includes('movie/popular') || endpoint.includes('trending/movie')) return { results: mockMovies };
    if (endpoint.includes('tv/popular') || endpoint.includes('trending/tv')) return { results: mockTV };
    if (endpoint.includes('movie/top_rated')) return { results: mockMovies };
    if (endpoint.includes('tv/top_rated')) return { results: mockTV };
    if (endpoint.includes('movie/')) {
        // Return details for specific movie, fallback to generic structure
        return mockDetails;
    }
    if (endpoint.includes('search')) return { results: [...mockMovies, ...mockTV] };
    return { results: [] };
};
