"use client";

import { useEffect, useMemo, useState } from "react";
import { tmdb } from "@/lib/tmdb";

const STORAGE_KEY = "streaming_country";
const REGIONS_STORAGE_KEY = "tmdb_watch_provider_regions_v1";
const REGIONS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Map common IANA timezones to ISO 3166-1 country codes */
const TZ_TO_COUNTRY = {
    "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
    "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Phoenix": "US",
    "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Madrid": "ES",
    "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Zurich": "CH",
    "Europe/Vienna": "AT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
    "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
    "Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Athens": "GR", "Europe/Istanbul": "TR",
    "Europe/Lisbon": "PT", "Europe/Dublin": "IE", "Europe/Moscow": "RU",
    "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
    "Asia/Taipei": "TW", "Asia/Singapore": "SG", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
    "Asia/Dubai": "AE", "Asia/Bangkok": "TH", "Asia/Jakarta": "ID", "Asia/Manila": "PH",
    "Asia/Kuala_Lumpur": "MY", "Asia/Ho_Chi_Minh": "VN",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Perth": "AU",
    "Pacific/Auckland": "NZ", "America/Toronto": "CA", "America/Vancouver": "CA",
    "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Buenos_Aires": "AR",
    "America/Santiago": "CL", "America/Bogota": "CO", "America/Lima": "PE",
    "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG", "Africa/Cairo": "EG",
    "Asia/Jerusalem": "IL", "Asia/Riyadh": "SA",
};

function detectCountryFromLocale() {
    try {
        // Try timezone first (most reliable)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz];
        // Try region from timezone path (e.g. "America/New_York" → check broader region)
        if (tz) {
            const parts = tz.split("/");
            for (const [key, code] of Object.entries(TZ_TO_COUNTRY)) {
                if (key.startsWith(parts[0] + "/")) return code;
            }
        }
    } catch (_) {}
    try {
        // Fallback: navigator.language region subtag (e.g. "en-US" → "US")
        const lang = navigator.language || navigator.languages?.[0] || "";
        const match = lang.match(/[-_]([A-Z]{2})$/i);
        if (match) return match[1].toUpperCase();
    } catch (_) {}
    return "US";
}

function getDefaultCountry() {
    if (typeof window === "undefined") return "US";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && typeof saved === "string" && saved.length === 2) return saved.toUpperCase();
    return detectCountryFromLocale();
}

export default function StreamingAvailability({ mediaType, mediaId }) {
    const [country, setCountry] = useState(getDefaultCountry);
    const [loading, setLoading] = useState(true);
    const [providers, setProviders] = useState(null);
    const [regions, setRegions] = useState([]);
    const [theatricalDate, setTheatricalDate] = useState(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, country);
        } catch (_) {}
    }, [country]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const readCache = () => {
            try {
                const raw = window.localStorage.getItem(REGIONS_STORAGE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== "object") return null;
                const ts = Number(parsed.ts || 0);
                const list = Array.isArray(parsed.list) ? parsed.list : [];
                if (!Number.isFinite(ts) || !Array.isArray(list) || list.length === 0) return null;
                if (Date.now() - ts > REGIONS_TTL_MS) return null;
                return list;
            } catch {
                return null;
            }
        };

        const cached = readCache();
        if (cached) {
            setRegions(cached);
            return;
        }

        let mounted = true;
        tmdb.getWatchProviderRegions().then((data) => {
            if (!mounted) return;
            const list = Array.isArray(data?.results) ? data.results : [];
            const normalized = list
                .map((r) => ({
                    iso_3166_1: String(r?.iso_3166_1 || "").toUpperCase(),
                    english_name: String(r?.english_name || r?.native_name || "").trim(),
                }))
                .filter((r) => r.iso_3166_1.length === 2 && r.english_name);

            normalized.sort((a, b) => a.english_name.localeCompare(b.english_name));
            setRegions(normalized);
            try {
                window.localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify({ ts: Date.now(), list: normalized }));
            } catch (_) {}
        }).catch(() => {
            if (!mounted) return;
            setRegions([]);
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            if (!mediaType || mediaId == null) return;
            setLoading(true);
            try {
                const [data, releaseDates] = await Promise.all([
                    tmdb.getWatchProviders(mediaType, mediaId),
                    mediaType === "movie" ? tmdb.getMovieReleaseDates(mediaId) : Promise.resolve(null),
                ]);
                if (!mounted) return;
                const results = data?.results || {};
                const entry = results?.[country] || null;
                setProviders(entry);

                if (mediaType === "movie") {
                    const list = Array.isArray(releaseDates?.results) ? releaseDates.results : [];
                    const countryEntry = list.find((r) => String(r?.iso_3166_1 || "").toUpperCase() === String(country).toUpperCase());
                    const releases = Array.isArray(countryEntry?.release_dates) ? countryEntry.release_dates : [];

                    // Prefer theatrical (type 3) then wide theatrical (type 2)
                    const theatrical = releases.find((r) => Number(r?.type) === 3 && r?.release_date) || releases.find((r) => Number(r?.type) === 2 && r?.release_date) || null;
                    if (theatrical?.release_date) {
                        const d = new Date(theatrical.release_date);
                        setTheatricalDate(Number.isFinite(d.getTime()) ? d : null);
                    } else {
                        setTheatricalDate(null);
                    }
                } else {
                    setTheatricalDate(null);
                }
            } catch {
                if (!mounted) return;
                setProviders(null);
                setTheatricalDate(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        run();
        return () => {
            mounted = false;
        };
    }, [mediaType, mediaId, country]);

    const sections = useMemo(() => {
        const p = providers || {};
        const out = [];
        if (Array.isArray(p.flatrate) && p.flatrate.length > 0) out.push({ key: "flat", label: "Stream", items: p.flatrate });
        if (Array.isArray(p.rent) && p.rent.length > 0) out.push({ key: "rent", label: "Rent", items: p.rent });
        if (Array.isArray(p.buy) && p.buy.length > 0) out.push({ key: "buy", label: "Buy", items: p.buy });
        return out;
    }, [providers]);

    const hasAny = sections.length > 0;
    const tmdbLink = providers?.link ? String(providers.link) : "";
    const countryName = useMemo(() => {
        const hit = regions.find((r) => String(r.iso_3166_1).toUpperCase() === String(country).toUpperCase());
        return hit?.english_name || country;
    }, [regions, country]);

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
                <div className="text-lg font-bold text-white">Where to watch</div>
                <select
                    value={country}
                    onChange={(e) => setCountry(String(e.target.value || "US").toUpperCase())}
                    className="bg-background text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50 min-w-44 [color-scheme:dark]"
                    aria-label="Country"
                >
                    {(regions.length > 0 ? regions : [{ iso_3166_1: "US", english_name: "United States" }]).map((r) => (
                        <option key={r.iso_3166_1} value={r.iso_3166_1}>
                            {r.english_name} ({r.iso_3166_1})
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="mt-4 space-y-2">
                    <div className="h-3 bg-white/10 rounded w-2/3" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
            ) : !hasAny ? (
                <div className="mt-4 text-sm text-textSecondary">
                    {mediaType === "movie" && theatricalDate ? (
                        <div>
                            This movie had a theatrical release in {countryName} on {theatricalDate.toLocaleDateString()}
                        </div>
                    ) : null}
                    <div>Currently not available on major platforms (TMDB data)</div>
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    {mediaType === "movie" && theatricalDate ? (
                        <div className="text-sm text-textSecondary">
                            This movie had a theatrical release in {countryName} on {theatricalDate.toLocaleDateString()}
                        </div>
                    ) : null}
                    {tmdbLink ? (
                        <a
                            href={tmdbLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-xs font-semibold text-accent hover:underline"
                        >
                            View on TMDB
                        </a>
                    ) : null}
                    {sections.map((s) => (
                        <div key={s.key}>
                            <div className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-2">{s.label}</div>
                            <div className="flex flex-wrap gap-2">
                                {s.items.slice(0, 12).map((p) => (
                                    <div
                                        key={p.provider_id}
                                        className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2"
                                        title={p.provider_name}
                                    >
                                        {p.logo_path ? (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                                                alt={p.provider_name}
                                                className="w-6 h-6 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-md bg-white/10" />
                                        )}
                                        <div className="text-xs text-white/90">{p.provider_name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
