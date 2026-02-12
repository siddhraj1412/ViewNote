"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb";
import { Building2, MapPin, Calendar } from "lucide-react";
import { parseSlugId, getMediaUrl } from "@/lib/slugify";

export default function ProductionPage() {
    const params = useParams();
    const { id: parsedId } = parseSlugId(params.id);
    const companyId = parsedId || Number(params.id);
    const [company, setCompany] = useState(null);
    const [movies, setMovies] = useState([]);
    const [tvShows, setTvShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("movies");

    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                const [companyData, moviesData, tvData] = await Promise.all([
                    tmdb.getProductionCompanyDetails(companyId),
                    tmdb.getProductionCompanyMovies(companyId),
                    tmdb.getProductionCompanyTV(companyId),
                ]);

                setCompany(companyData);
                setMovies(moviesData);
                setTvShows(tvData);
            } catch (error) {
                console.error("Error fetching production company:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyData();
    }, [companyId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-16">
                <div className="text-2xl text-textSecondary">Production company not found</div>
            </div>
        );
    }

    const displayMedia = activeTab === "movies" ? movies : tvShows;

    return (
        <main className="min-h-screen bg-background pt-16">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row gap-8 mb-12">
                    {/* Logo */}
                    {company.logo_path && (
                        <div className="w-full md:w-64 h-64 bg-white/5 rounded-2xl p-8 flex items-center justify-center flex-shrink-0">
                            <div className="relative w-full h-full">
                                <Image
                                    src={tmdb.getImageUrl(company.logo_path, "w500")}
                                    alt={company.name}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-5xl font-bold mb-4">{company.name}</h1>

                        {company.description && (
                            <p className="text-textSecondary text-lg mb-6 leading-relaxed">
                                {company.description}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-6 text-textSecondary">
                            {company.headquarters && (
                                <div className="flex items-center gap-2">
                                    <MapPin size={20} className="text-accent" />
                                    <span>{company.headquarters}</span>
                                </div>
                            )}

                            {company.origin_country && (
                                <div className="flex items-center gap-2">
                                    <Building2 size={20} className="text-accent" />
                                    <span>{company.origin_country}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab("movies")}
                        className={`px-6 py-3 rounded-xl font-bold transition ${activeTab === "movies"
                                ? "bg-accent text-background"
                                : "bg-secondary text-textSecondary hover:bg-white/5"
                            }`}
                    >
                        Movies ({movies.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("tv")}
                        className={`px-6 py-3 rounded-xl font-bold transition ${activeTab === "tv"
                                ? "bg-accent text-background"
                                : "bg-secondary text-textSecondary hover:bg-white/5"
                            }`}
                    >
                        TV Shows ({tvShows.length})
                    </button>
                </div>

                {/* Media Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {displayMedia.map((item) => (
                        <Link
                            key={item.id}
                            href={getMediaUrl(item, activeTab === "movies" ? "movie" : "tv")}
                            className="group"
                        >
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 shadow-lg group-hover:shadow-xl group-hover:shadow-accent/10 transition-shadow">
                                <Image
                                    src={tmdb.getImageUrl(item.poster_path)}
                                    alt={item.title || item.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition-colors mb-1">
                                {item.title || item.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-textSecondary">
                                <span>
                                    {(item.release_date || item.first_air_date || "").split("-")[0]}
                                </span>
                                {item.vote_average > 0 && (
                                    <>
                                        <span>•</span>
                                        <span className="text-accent font-bold">
                                            ★ {item.vote_average.toFixed(1)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>

                {displayMedia.length === 0 && (
                    <div className="text-center py-20 text-textSecondary">
                        No {activeTab} found for this production company.
                    </div>
                )}
            </div>
        </main>
    );
}
