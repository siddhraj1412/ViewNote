import JSZip from "jszip";
import Papa from "papaparse";
import supabase from "@/lib/supabase";
import { tmdb } from "@/lib/tmdb";
import eventBus from "@/lib/eventBus";

/**
 * Letterboxd Data Import Service — v3
 * Imports ONLY from ratings.csv, reviews.csv, and watchlist.csv.
 * All other CSV files in the export are ignored.
 * Uses multi-stage TMDB matching with aggressive fuzzy search.
 */

const BATCH_LIMIT = 450;
const TMDB_RATE_LIMIT_MS = 220; // ~4.5 req/s

// ── Helpers ──

function normalizeRating(val) {
    if (val === undefined || val === null || val === "") return 0;
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.max(0.5, Math.min(5, Math.round(n * 2) / 2));
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function dateToTimestamp(dateStr) {
    if (!dateStr) return new Date().toISOString();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function levenshteinDistance(a, b) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const matrix = [];
    for (let i = 0; i <= bl; i++) matrix[i] = [i];
    for (let j = 0; j <= al; j++) matrix[0][j] = j;
    for (let i = 1; i <= bl; i++) {
        for (let j = 1; j <= al; j++) {
            matrix[i][j] = b[i - 1] === a[j - 1]
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[bl][al];
}

function normalizeTitle(t) {
    if (!t) return "";
    return t
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[''""":!?,.\-\u2013\u2014()[\]{}]/g, "")
        .replace(/&/g, "and")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Robust CSV parsing with BOM handling and case-insensitive headers.
 */
function parseCSV(csvText) {
    const clean = csvText.replace(/^\uFEFF/, "").trim();
    const result = Papa.parse(clean, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim(),
        quoteChar: '"',
        escapeChar: '"',
    });
    return (result.data || []).filter(row => {
        return Object.values(row).some(v => v && v.toString().trim());
    });
}

/**
 * Get a column value from a row with case-insensitive fallback.
 */
function getCol(row, ...keys) {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== "") return row[key];
    }
    // Case-insensitive fallback
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const lower = key.toLowerCase();
        for (const rk of rowKeys) {
            if (rk.toLowerCase() === lower && row[rk] !== undefined && row[rk] !== "") {
                return row[rk];
            }
        }
    }
    return "";
}

function extractLetterboxdSlug(uri) {
    if (!uri) return null;
    const match = uri.match(/letterboxd\.com\/film\/([^/]+)/);
    return match ? match[1] : null;
}

/**
 * Multi-stage TMDB matching with aggressive fallback.
 * Targets >99% match rate.
 */
async function matchToTMDB(title, year, letterboxdURI) {
    if (!title) return null;

    const yearNum = year ? parseInt(year) : null;
    const normalizedInput = normalizeTitle(title);

    const scoreCandidate = (r, inputNorm, y) => {
        const rTitle = normalizeTitle(r.title || r.name || "");
        const rOrig = normalizeTitle(r.original_title || r.original_name || "");
        const dist1 = levenshteinDistance(inputNorm, rTitle);
        const dist2 = rOrig ? levenshteinDistance(inputNorm, rOrig) : Infinity;
        const dist = Math.min(dist1, dist2);
        const maxLen = Math.max(inputNorm.length, rTitle.length, 1);
        const similarity = 1 - dist / maxLen;

        let yearBonus = 0;
        const ry = r.release_date || r.first_air_date;
        const rYear = ry ? parseInt(ry.split("-")[0]) : null;
        if (y && rYear) {
            if (rYear === y) yearBonus = 0.15;
            else if (Math.abs(rYear - y) === 1) yearBonus = 0.05;
            else if (Math.abs(rYear - y) > 3) yearBonus = -0.15;
        }

        const popBoost = Math.min(0.05, (r.popularity || 0) / 10000);
        return similarity + yearBonus + popBoost;
    };

    // Strategy 1: Search movies
    try {
        const results = await tmdb.searchMovies(title);
        if (results && results.length > 0) {
            const scored = results.map((r) => ({
                result: r,
                score: scoreCandidate(r, normalizedInput, yearNum),
            })).sort((a, b) => b.score - a.score);

            if (scored[0].score >= 0.85) return scored[0].result;
            if (scored[0].score >= 0.6) {
                const best = scored[0].result;
                const bestYear = best.release_date ? parseInt(best.release_date.split("-")[0]) : null;
                if (!yearNum || (bestYear && Math.abs(bestYear - yearNum) <= 1)) {
                    return best;
                }
            }
        }
    } catch (err) {
        console.warn(`[LBImport] Movie search failed for "${title}":`, err.message);
    }

    await sleep(TMDB_RATE_LIMIT_MS);

    // Strategy 2: Multi search
    try {
        const results = await tmdb.searchMulti(title);
        if (results && results.length > 0) {
            const mediaResults = results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
            if (mediaResults.length > 0) {
                const scored = mediaResults.map((r) => ({
                    result: {
                        ...r,
                        title: r.title || r.name,
                        release_date: r.release_date || r.first_air_date,
                        media_type: r.media_type,
                    },
                    score: scoreCandidate(r, normalizedInput, yearNum),
                })).sort((a, b) => b.score - a.score);

                if (scored[0].score >= 0.55) return scored[0].result;
            }
        }
    } catch {
        // Ignore
    }

    await sleep(TMDB_RATE_LIMIT_MS);

    // Strategy 3: TV show specific search
    try {
        const tvResults = await tmdb.searchTV(title);
        if (tvResults && tvResults.length > 0) {
            const scored = tvResults.map((r) => ({
                result: { ...r, title: r.name, release_date: r.first_air_date, media_type: "tv" },
                score: scoreCandidate(r, normalizedInput, yearNum),
            })).sort((a, b) => b.score - a.score);

            if (scored[0].score >= 0.55) return scored[0].result;
        }
    } catch {
        // Ignore
    }

    await sleep(TMDB_RATE_LIMIT_MS);

    // Strategy 4: Slug-based search from Letterboxd URI
    const slug = extractLetterboxdSlug(letterboxdURI);
    if (slug) {
        try {
            const slugTitle = slug.replace(/-/g, " ");
            const slugResults = await tmdb.searchMovies(slugTitle);
            if (slugResults && slugResults.length > 0) {
                const scored = slugResults.map((r) => ({
                    result: r,
                    score: scoreCandidate(r, normalizeTitle(slugTitle), yearNum),
                })).sort((a, b) => b.score - a.score);

                if (scored[0].score >= 0.5) return scored[0].result;
                if (yearNum) {
                    const yearMatch = slugResults.find((r) => {
                        const ry = r.release_date ? parseInt(r.release_date.split("-")[0]) : null;
                        return ry && Math.abs(ry - yearNum) <= 1;
                    });
                    if (yearMatch) return yearMatch;
                }
                return slugResults[0];
            }
        } catch {
            // Ignore
        }
        await sleep(TMDB_RATE_LIMIT_MS);
    }

    // Strategy 5: Try alternate title forms
    const alternateForms = [];
    if (title.toLowerCase().startsWith("the ")) {
        alternateForms.push(title.substring(4));
    } else {
        alternateForms.push("The " + title);
    }
    const withoutParens = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (withoutParens !== title) alternateForms.push(withoutParens);
    if (title.includes("&")) alternateForms.push(title.replace(/&/g, "and"));
    if (title.includes(" and ")) alternateForms.push(title.replace(/ and /gi, " & "));

    for (const alt of alternateForms) {
        try {
            const altResults = await tmdb.searchMovies(alt);
            if (altResults && altResults.length > 0) {
                const scored = altResults.map((r) => ({
                    result: r,
                    score: scoreCandidate(r, normalizeTitle(alt), yearNum),
                })).sort((a, b) => b.score - a.score);
                if (scored[0].score >= 0.6) return scored[0].result;
            }
        } catch { /* ignore */ }
        await sleep(TMDB_RATE_LIMIT_MS);
    }

    // Strategy 6: Ultimate fallback — first movie result
    try {
        const fallback = await tmdb.searchMovies(title);
        if (fallback && fallback.length > 0) return fallback[0];
    } catch { /* ignore */ }

    return null;
}

/**
 * Extract and parse CSV files from Letterboxd ZIP export.
 */
async function extractZip(file) {
    const zip = await JSZip.loadAsync(file);
    const parsed = {};

    // Only import these 3 CSV files — ignore diary, watched, likes
    const fileMap = {
        "ratings.csv": "ratings",
        "reviews.csv": "reviews",
        "watchlist.csv": "watchlist",
    };

    for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const filename = path.split("/").pop().toLowerCase();

        if (fileMap[filename] && !parsed[fileMap[filename]]) {
            const text = await zipEntry.async("text");
            parsed[fileMap[filename]] = parseCSV(text);
        }
    }

    return parsed;
}

async function getExistingImportedIds(userId) {
    const existing = {
        watched: new Set(),
        ratings: new Map(),
        watchlist: new Set(),
    };

    try {
        // Only fetch the columns we actually need instead of select('*')
        const [watchedRes, ratingsRes, watchlistRes] = await Promise.all([
            supabase.from("user_watched").select('"mediaId"').eq("userId", userId).limit(10000),
            supabase.from("user_ratings").select('id, "mediaId", rating').eq("userId", userId).limit(10000),
            supabase.from("user_watchlist").select('"mediaId"').eq("userId", userId).limit(10000),
        ]);

        (watchedRes.data || []).forEach((d) => existing.watched.add(d.mediaId));
        (ratingsRes.data || []).forEach((d) => existing.ratings.set(d.id, d));
        (watchlistRes.data || []).forEach((d) => existing.watchlist.add(d.mediaId));
    } catch (err) {
        console.warn("[LBImport] Error fetching existing data (continuing anyway):", err);
    }

    return existing;
}

async function commitBatches(operations) {
    // Group operations by collection for bulk upserts
    const grouped = {};
    for (const op of operations) {
        if (op.type === "set") {
            if (!grouped[op.collection]) grouped[op.collection] = [];
            grouped[op.collection].push({ id: op.docId, ...op.data });
        }
    }

    for (const [table, rows] of Object.entries(grouped)) {
        // Upsert in chunks of 100 to prevent timeouts
        const CHUNK_SIZE = 100;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from(table)
                .upsert(chunk, { onConflict: 'id' });

            if (error) {
                console.error(`[LBImport] Upsert error for ${table} chunk ${i / CHUNK_SIZE + 1}:`, error);
                throw error;
            }
            // Small delay between chunks to prevent overwhelming the database
            if (i + CHUNK_SIZE < rows.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
}

/**
 * Main import function.
 * Priority: ratings.csv -> reviews.csv -> diary.csv -> watched.csv -> likes -> watchlist.csv
 * All rated/reviewed/watched items get added to user_watched.
 * Reviews merge into the rating doc.
 */
export async function importLetterboxdData(zipFile, user, onProgress = () => {}) {
    if (!zipFile || !user?.uid) {
        throw new Error("Missing ZIP file or user");
    }

    const summary = {
        watched: { total: 0, imported: 0, skipped: 0, failed: 0 },
        ratings: { total: 0, imported: 0, skipped: 0, failed: 0 },
        reviews: { total: 0, imported: 0, skipped: 0, failed: 0 },
        watchlist: { total: 0, imported: 0, skipped: 0, failed: 0 },
        errors: [],
        tmdbMatches: 0,
        tmdbMisses: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
    };

    // Phase 1: Extract ZIP
    onProgress({ phase: "extract", current: 0, total: 1, message: "Extracting ZIP file..." });
    let parsed;
    try {
        parsed = await extractZip(zipFile);
    } catch (err) {
        throw new Error(`Failed to extract ZIP: ${err.message}`);
    }
    onProgress({ phase: "extract", current: 1, total: 1, message: "ZIP extracted" });

    const detectedFiles = Object.keys(parsed);
    if (detectedFiles.length === 0) {
        throw new Error("No supported Letterboxd CSV files found in ZIP. Expected: ratings.csv, reviews.csv, watchlist.csv");
    }

    // Phase 2: Get existing data for deduplication
    onProgress({ phase: "dedup", current: 0, total: 1, message: "Checking existing data..." });
    const existing = await getExistingImportedIds(user.uid);
    onProgress({ phase: "dedup", current: 1, total: 1, message: "Ready" });

    // Phase 3: Build unified movie map from all CSVs
    const movieMap = new Map();

    const collectTitles = (rows) => {
        if (!rows) return;
        for (const row of rows) {
            const title = getCol(row, "Name", "Title", "Film");
            const year = getCol(row, "Year");
            const uri = getCol(row, "Letterboxd URI", "URL", "URI");
            if (!title) continue;
            const key = `${title.toLowerCase().trim()}|||${year}`;
            if (!movieMap.has(key)) {
                movieMap.set(key, { title: title.trim(), year, uri, tmdb: null });
            }
        }
    };

    collectTitles(parsed.ratings);
    collectTitles(parsed.reviews);
    collectTitles(parsed.watchlist);

    // Phase 4: TMDB matching
    const uniqueMovies = Array.from(movieMap.entries());
    const tmdbTotal = uniqueMovies.length;
    onProgress({ phase: "tmdb", current: 0, total: tmdbTotal, message: `Matching ${tmdbTotal} titles...` });

    for (let i = 0; i < uniqueMovies.length; i++) {
        const [key, entry] = uniqueMovies[i];
        try {
            // Add per-match timeout of 15s to prevent hanging
            const tmdbResult = await Promise.race([
                matchToTMDB(entry.title, entry.year, entry.uri),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TMDB match timeout")), 15000)),
            ]);
            if (tmdbResult) {
                movieMap.get(key).tmdb = tmdbResult;
                summary.tmdbMatches++;
            } else {
                summary.tmdbMisses++;
                summary.errors.push(`No TMDB match: "${entry.title}" (${entry.year})`);
            }
        } catch (err) {
            summary.tmdbMisses++;
            summary.errors.push(`TMDB error: "${entry.title}" - ${err.message}`);
        }

        if (i % 3 === 0 || i === uniqueMovies.length - 1) {
            onProgress({
                phase: "tmdb",
                current: i + 1,
                total: tmdbTotal,
                message: `${i + 1}/${tmdbTotal} — "${entry.title}"`,
            });
        }

        if (i < uniqueMovies.length - 1) {
            await sleep(TMDB_RATE_LIMIT_MS);
        }
    }

    // Phase 5: Import data to Firestore
    const operations = [];
    const userId = user.uid;
    const username = user.username || "";
    const processedMediaIds = new Set();

    const getTMDB = (row) => {
        const title = getCol(row, "Name", "Title", "Film");
        const year = getCol(row, "Year");
        if (!title) return null;
        const key = `${title.toLowerCase().trim()}|||${year}`;
        return movieMap.get(key)?.tmdb || null;
    };

    const getMediaType = (tmdbData) => {
        if (tmdbData.media_type === "tv") return "tv";
        if (tmdbData.first_air_date && !tmdbData.release_date) return "tv";
        return "movie";
    };

    const ensureWatched = (mediaId, mediaType, tmdbData) => {
        if (processedMediaIds.has(`watched_${mediaId}`)) return;
        if (existing.watched.has(mediaId)) {
            processedMediaIds.add(`watched_${mediaId}`);
            return;
        }
        const docId = `${userId}_${mediaType}_${mediaId}`;
        operations.push({
            type: "set",
            collection: "user_watched",
            docId,
            data: {
                userId,
                mediaId: Number(mediaId),
                mediaType,
                title: tmdbData.title || tmdbData.name || "",
                poster_path: tmdbData.poster_path || "",
                addedAt: new Date().toISOString(),
                importedFrom: "letterboxd",
            },
        });
        existing.watched.add(mediaId);
        processedMediaIds.add(`watched_${mediaId}`);
        summary.watched.imported++;
    };

    // ── 1. Import Ratings ──
    if (parsed.ratings) {
        summary.ratings.total = parsed.ratings.length;
        onProgress({ phase: "import", current: 0, total: parsed.ratings.length, message: "Importing ratings..." });

        for (let i = 0; i < parsed.ratings.length; i++) {
            const row = parsed.ratings[i];
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.ratings.failed++; continue; }

            const mediaId = tmdbData.id;
            const mediaType = getMediaType(tmdbData);
            const rating = normalizeRating(getCol(row, "Rating"));
            if (rating <= 0) { summary.ratings.skipped++; continue; }

            const ratingDocId = `${userId}_${mediaType}_${mediaId}`;
            const existingRating = existing.ratings.get(ratingDocId);

            if (existingRating && existingRating.rating > 0 && existingRating.importedFrom !== "letterboxd") {
                summary.ratings.skipped++;
                continue;
            }

            const ratingDateStr = getCol(row, "Date");

            operations.push({
                type: "set",
                collection: "user_ratings",
                docId: ratingDocId,
                data: {
                    userId,
                    mediaId: Number(mediaId),
                    mediaType,
                    rating,
                    title: tmdbData.title || tmdbData.name || "",
                    poster_path: tmdbData.poster_path || "",
                    username,
                    ratedAt: dateToTimestamp(ratingDateStr),
                    importedFrom: "letterboxd",
                },
            });

            existing.ratings.set(ratingDocId, { rating });
            ensureWatched(mediaId, mediaType, tmdbData);
            summary.ratings.imported++;
        }
    }

    // ── 2. Import Reviews (merge into rating docs) ──
    if (parsed.reviews) {
        summary.reviews.total = parsed.reviews.length;
        onProgress({ phase: "import", current: 0, total: parsed.reviews.length, message: "Importing reviews..." });

        for (let i = 0; i < parsed.reviews.length; i++) {
            const row = parsed.reviews[i];
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.reviews.failed++; continue; }

            const mediaId = tmdbData.id;
            const mediaType = getMediaType(tmdbData);
            const reviewText = getCol(row, "Review", "Review Text");
            if (!reviewText.trim()) { summary.reviews.skipped++; continue; }

            const rating = normalizeRating(getCol(row, "Rating"));
            const ratingDocId = `${userId}_${mediaType}_${mediaId}`;
            const watchedDate = parseDate(getCol(row, "Watched Date", "Date"));
            const isRewatch = ["yes", "true"].includes(
                getCol(row, "Rewatch").toString().toLowerCase()
            );
            const tags = getCol(row, "Tags");

            const reviewData = {
                userId,
                mediaId: Number(mediaId),
                mediaType,
                title: tmdbData.title || tmdbData.name || "",
                poster_path: tmdbData.poster_path || "",
                review: reviewText,
                username,
                ratedAt: dateToTimestamp(watchedDate || getCol(row, "Date")),
                importedFrom: "letterboxd",
            };
            if (rating > 0) reviewData.rating = rating;
            if (watchedDate) reviewData.watchedDate = watchedDate;
            if (isRewatch) { reviewData.isRewatch = true; reviewData.viewCount = 2; }
            if (tags) {
                const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
                if (tagList.length > 0) reviewData.tags = tagList;
            }

            operations.push({
                type: "set",
                collection: "user_ratings",
                docId: ratingDocId,
                data: reviewData,
            });

            existing.ratings.set(ratingDocId, { rating: rating || 0, review: reviewText });
            ensureWatched(mediaId, mediaType, tmdbData);
            summary.reviews.imported++;
        }
    }

    // ── 3. Import Watchlist ──
    if (parsed.watchlist) {
        summary.watchlist.total = parsed.watchlist.length;
        onProgress({ phase: "import", current: 0, total: parsed.watchlist.length, message: "Importing watchlist..." });

        for (const row of parsed.watchlist) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.watchlist.failed++; continue; }

            const mediaId = tmdbData.id;
            const mediaType = getMediaType(tmdbData);

            if (existing.watched.has(mediaId) || existing.watchlist.has(mediaId)) {
                summary.watchlist.skipped++;
                continue;
            }

            const docId = `${userId}_${mediaType}_${mediaId}`;
            const addedDate = getCol(row, "Date");

            operations.push({
                type: "set",
                collection: "user_watchlist",
                docId,
                data: {
                    userId,
                    mediaId: Number(mediaId),
                    mediaType,
                    title: tmdbData.title || tmdbData.name || "",
                    poster_path: tmdbData.poster_path || "",
                    addedAt: dateToTimestamp(addedDate),
                    importedFrom: "letterboxd",
                },
            });

            existing.watchlist.add(mediaId);
            summary.watchlist.imported++;
        }
    }

    // Phase 6: Commit all operations
    if (operations.length > 0) {
        const totalOps = operations.length;
        onProgress({ phase: "commit", current: 0, total: totalOps, message: `Saving ${totalOps} records...` });

        try {
            // Update progress during commit
            let completed = 0;
            const originalCommit = commitBatches;
            
            // Wrap commitBatches to track progress
            const progressTracker = async (ops) => {
                const grouped = {};
                for (const op of ops) {
                    if (op.type === "set") {
                        if (!grouped[op.collection]) grouped[op.collection] = [];
                        grouped[op.collection].push({ id: op.docId, ...op.data });
                    }
                }

                for (const [table, rows] of Object.entries(grouped)) {
                    const CHUNK_SIZE = 100;
                    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                        const chunk = rows.slice(i, i + CHUNK_SIZE);
                        const { error } = await supabase
                            .from(table)
                            .upsert(chunk, { onConflict: 'id' });

                        if (error) {
                            console.error(`[LBImport] Upsert error for ${table} chunk ${i / CHUNK_SIZE + 1}:`, error);
                            throw error;
                        }
                        
                        completed += chunk.length;
                        onProgress({ 
                            phase: "commit", 
                            current: completed, 
                            total: totalOps, 
                            message: `Saved ${completed}/${totalOps} records...` 
                        });
                        
                        if (i + CHUNK_SIZE < rows.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }
            };

            await progressTracker(operations);
            onProgress({ phase: "commit", current: totalOps, total: totalOps, message: "All records saved!" });
        } catch (err) {
            summary.errors.push(`Database write error: ${err.message}`);
            throw new Error(`Failed to write to database: ${err.message}`);
        }
    }

    // Save import record
    try {
        await supabase
            .from("user_imports")
            .upsert({
                id: `${userId}_letterboxd`,
                userId,
                source: "letterboxd",
                importedAt: new Date().toISOString(),
                summary: {
                    watched: summary.watched.imported,
                    ratings: summary.ratings.imported,
                    reviews: summary.reviews.imported,
                    watchlist: summary.watchlist.imported,
                    tmdbMatches: summary.tmdbMatches,
                    tmdbMisses: summary.tmdbMisses,
                    errorCount: summary.errors.length,
                },
            }, { onConflict: 'id' });
    } catch (_) {
        // Non-critical
    }

    eventBus.emit("MEDIA_UPDATED", { action: "IMPORT_COMPLETE", userId });
    eventBus.emit("PROFILE_DATA_INVALIDATED", { userId });

    summary.completedAt = new Date().toISOString();
    return summary;
}

/**
 * Check if user has previously imported Letterboxd data.
 */
export async function getImportHistory(userId) {
    try {
        const { data, error } = await supabase
            .from("user_imports")
            .select('*')
            .eq('id', `${userId}_letterboxd`)
            .single();

        if (error && error.code === 'PGRST116') return null;
        return data || null;
    } catch {
        return null;
    }
}
