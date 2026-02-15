import JSZip from "jszip";
import Papa from "papaparse";
import { db } from "@/lib/firebase";
import { doc, writeBatch, collection, query, where, getDocs, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { tmdb } from "@/lib/tmdb";
import eventBus from "@/lib/eventBus";

/**
 * Letterboxd Data Import Service
 * Handles complete ZIP export import with TMDB matching, deduplication, and idempotent writes.
 */

const BATCH_LIMIT = 450; // Firestore batch limit is 500, leave room
const TMDB_RATE_LIMIT_MS = 260; // ~4 req/s to stay within TMDB rate limits

// Letterboxd rating scale: 0.5–5.0 in 0.5 steps (same as ours)
function normalizeRating(val) {
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.max(0.5, Math.min(5, Math.round(n * 2) / 2));
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a CSV string using PapaParse.
 * Returns an array of row objects.
 */
function parseCSV(csvText) {
    const result = Papa.parse(csvText.trim(), {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
    });
    return result.data || [];
}

/**
 * Match a movie title+year to TMDB.
 * First tries letterboxdURI → TMDB ID extraction, then falls back to search.
 */
async function matchToTMDB(title, year, letterboxdURI) {
    if (!title) return null;

    // Try searching with year first for better accuracy
    try {
        const searchQuery = year ? `${title}` : title;
        const results = await tmdb.searchMovies(searchQuery);

        if (results && results.length > 0) {
            // Try exact year match first
            if (year) {
                const yearNum = parseInt(year);
                const exactMatch = results.find((r) => {
                    const releaseYear = r.release_date ? parseInt(r.release_date.split("-")[0]) : null;
                    return releaseYear === yearNum && r.title.toLowerCase() === title.toLowerCase();
                });
                if (exactMatch) return exactMatch;

                // Fuzzy year match (±1 year)
                const fuzzyMatch = results.find((r) => {
                    const releaseYear = r.release_date ? parseInt(r.release_date.split("-")[0]) : null;
                    return releaseYear && Math.abs(releaseYear - yearNum) <= 1 &&
                        r.title.toLowerCase() === title.toLowerCase();
                });
                if (fuzzyMatch) return fuzzyMatch;

                // Partial title match with year
                const partialMatch = results.find((r) => {
                    const releaseYear = r.release_date ? parseInt(r.release_date.split("-")[0]) : null;
                    return releaseYear === yearNum;
                });
                if (partialMatch) return partialMatch;
            }

            // Fall back to first result
            return results[0];
        }
    } catch (err) {
        console.warn(`[LBImport] TMDB search failed for "${title}" (${year}):`, err.message);
    }

    return null;
}

/**
 * Extract and parse all supported files from a Letterboxd ZIP export.
 */
async function extractZip(file) {
    const zip = await JSZip.loadAsync(file);
    const parsed = {};

    const fileMap = {
        "watched.csv": "watched",
        "diary.csv": "diary",
        "ratings.csv": "ratings",
        "reviews.csv": "reviews",
        "likes.csv": "likes",         // Could be likes/films.csv
        "watchlist.csv": "watchlist",
        "lists.csv": "lists",
    };

    // Also check nested paths (likes/films.csv, etc.)
    for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const filename = path.split("/").pop().toLowerCase();

        // Check direct match
        if (fileMap[filename]) {
            const text = await zipEntry.async("text");
            parsed[fileMap[filename]] = parseCSV(text);
            continue;
        }

        // Special: likes/films.csv or likes/film.csv
        if (path.toLowerCase().includes("likes") && filename.endsWith(".csv")) {
            const text = await zipEntry.async("text");
            parsed.likes = parseCSV(text);
            continue;
        }

        // Special: lists folder - each file is a separate list
        if (path.toLowerCase().includes("lists/") && filename.endsWith(".csv") && filename !== "lists.csv") {
            if (!parsed.listFiles) parsed.listFiles = [];
            const text = await zipEntry.async("text");
            parsed.listFiles.push({
                name: filename.replace(".csv", "").replace(/-/g, " "),
                items: parseCSV(text),
            });
        }
    }

    return parsed;
}

/**
 * Check for existing imported data to support deduplication.
 */
async function getExistingImportedIds(userId) {
    const existing = {
        watched: new Set(),
        ratings: new Set(),
        watchlist: new Set(),
        liked: new Set(),
    };

    try {
        const [watchedSnap, ratingsSnap, watchlistSnap] = await Promise.all([
            getDocs(query(collection(db, "user_watched"), where("userId", "==", userId))),
            getDocs(query(collection(db, "user_ratings"), where("userId", "==", userId))),
            getDocs(query(collection(db, "user_watchlist"), where("userId", "==", userId))),
        ]);

        watchedSnap.docs.forEach((d) => existing.watched.add(d.data().mediaId));
        ratingsSnap.docs.forEach((d) => existing.ratings.add(d.id));
        watchlistSnap.docs.forEach((d) => existing.watchlist.add(d.data().mediaId));
    } catch (err) {
        console.warn("[LBImport] Error fetching existing data:", err);
    }

    return existing;
}

/**
 * Commit batched writes to Firestore, splitting into chunks if needed.
 */
async function commitBatches(operations) {
    const chunks = [];
    for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
        chunks.push(operations.slice(i, i + BATCH_LIMIT));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const op of chunk) {
            if (op.type === "set") {
                batch.set(doc(db, op.collection, op.docId), op.data, { merge: true });
            } else if (op.type === "delete") {
                batch.delete(doc(db, op.collection, op.docId));
            }
        }
        await batch.commit();
    }
}

/**
 * Main import function.
 * @param {File} zipFile - The Letterboxd ZIP file
 * @param {Object} user - Firebase user object {uid, username, ...}
 * @param {Function} onProgress - Progress callback ({phase, current, total, message})
 * @returns {Object} Import summary
 */
export async function importLetterboxdData(zipFile, user, onProgress = () => {}) {
    if (!zipFile || !user?.uid) {
        throw new Error("Missing ZIP file or user");
    }

    const summary = {
        watched: { total: 0, imported: 0, skipped: 0, failed: 0 },
        ratings: { total: 0, imported: 0, skipped: 0, failed: 0 },
        reviews: { total: 0, imported: 0, skipped: 0, failed: 0 },
        likes: { total: 0, imported: 0, skipped: 0, failed: 0 },
        watchlist: { total: 0, imported: 0, skipped: 0, failed: 0 },
        lists: { total: 0, imported: 0, skipped: 0, failed: 0 },
        diary: { total: 0, imported: 0, skipped: 0, failed: 0 },
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
    onProgress({ phase: "extract", current: 1, total: 1, message: "ZIP extracted successfully" });

    const detectedFiles = Object.keys(parsed).filter((k) => k !== "listFiles");
    if (detectedFiles.length === 0 && !parsed.listFiles?.length) {
        throw new Error("No supported Letterboxd files found in ZIP. Expected: watched.csv, diary.csv, ratings.csv, reviews.csv, likes.csv, watchlist.csv");
    }

    // Phase 2: Get existing data for deduplication
    onProgress({ phase: "dedup", current: 0, total: 1, message: "Checking existing data..." });
    const existing = await getExistingImportedIds(user.uid);
    onProgress({ phase: "dedup", current: 1, total: 1, message: "Deduplication check complete" });

    // Phase 3: Build unified movie map from all CSVs
    // Collect all unique title+year across all files for TMDB matching
    const movieMap = new Map(); // key: "title|||year" → TMDB data
    const allEntries = [];

    // Gather all titles that need TMDB resolution
    const collectTitles = (rows, source) => {
        for (const row of rows) {
            const title = row.Name || row.Title || row.name || row.title || "";
            const year = row.Year || row.year || "";
            const letterboxdURI = row["Letterboxd URI"] || row.URL || "";
            if (!title) continue;
            const key = `${title.toLowerCase()}|||${year}`;
            if (!movieMap.has(key)) {
                movieMap.set(key, { title, year, letterboxdURI, tmdb: null });
            }
            allEntries.push({ ...row, _key: key, _source: source });
        }
    };

    if (parsed.watched) collectTitles(parsed.watched, "watched");
    if (parsed.diary) collectTitles(parsed.diary, "diary");
    if (parsed.ratings) collectTitles(parsed.ratings, "ratings");
    if (parsed.reviews) collectTitles(parsed.reviews, "reviews");
    if (parsed.likes) collectTitles(parsed.likes, "likes");
    if (parsed.watchlist) collectTitles(parsed.watchlist, "watchlist");
    if (parsed.listFiles) {
        for (const list of parsed.listFiles) {
            collectTitles(list.items, `list:${list.name}`);
        }
    }

    // Phase 4: TMDB matching
    const uniqueMovies = Array.from(movieMap.entries());
    const tmdbTotal = uniqueMovies.length;
    onProgress({ phase: "tmdb", current: 0, total: tmdbTotal, message: `Matching ${tmdbTotal} titles to TMDB...` });

    for (let i = 0; i < uniqueMovies.length; i++) {
        const [key, entry] = uniqueMovies[i];
        try {
            const tmdbResult = await matchToTMDB(entry.title, entry.year, entry.letterboxdURI);
            if (tmdbResult) {
                movieMap.get(key).tmdb = tmdbResult;
                summary.tmdbMatches++;
            } else {
                summary.tmdbMisses++;
                summary.errors.push(`No TMDB match: "${entry.title}" (${entry.year})`);
            }
        } catch (err) {
            summary.tmdbMisses++;
            summary.errors.push(`TMDB error for "${entry.title}": ${err.message}`);
        }

        if (i % 5 === 0 || i === uniqueMovies.length - 1) {
            onProgress({
                phase: "tmdb",
                current: i + 1,
                total: tmdbTotal,
                message: `Matched ${i + 1}/${tmdbTotal} titles...`,
            });
        }

        // Rate limiting
        if (i < uniqueMovies.length - 1) {
            await sleep(TMDB_RATE_LIMIT_MS);
        }
    }

    // Phase 5: Import data into Firestore
    const operations = [];
    const userId = user.uid;
    const username = user.username || "";

    // Helper: get TMDB data for a row
    const getTMDB = (row) => {
        const title = row.Name || row.Title || row.name || row.title || "";
        const year = row.Year || row.year || "";
        const key = `${title.toLowerCase()}|||${year}`;
        return movieMap.get(key)?.tmdb || null;
    };

    // ── Import Watched ──
    if (parsed.watched) {
        summary.watched.total = parsed.watched.length;
        onProgress({ phase: "import", current: 0, total: parsed.watched.length, message: "Importing watched films..." });

        for (const row of parsed.watched) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.watched.failed++; continue; }
            const mediaId = tmdbData.id;

            if (existing.watched.has(mediaId)) {
                summary.watched.skipped++;
                continue;
            }

            const docId = `${userId}_movie_${mediaId}`;
            operations.push({
                type: "set",
                collection: "user_watched",
                docId,
                data: {
                    userId,
                    mediaId: Number(mediaId),
                    mediaType: "movie",
                    title: tmdbData.title || "",
                    poster_path: tmdbData.poster_path || "",
                    addedAt: serverTimestamp(),
                    importedFrom: "letterboxd",
                },
            });
            summary.watched.imported++;
        }
    }

    // ── Import Diary (→ watched + ratings + reviews) ──
    if (parsed.diary) {
        summary.diary.total = parsed.diary.length;
        onProgress({ phase: "import", current: 0, total: parsed.diary.length, message: "Importing diary entries..." });

        for (const row of parsed.diary) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.diary.failed++; continue; }
            const mediaId = tmdbData.id;
            const docId = `${userId}_movie_${mediaId}`;
            const watchedDate = parseDate(row["Watched Date"] || row.Date || row.date);
            const rating = normalizeRating(row.Rating || row.rating || 0);
            const reviewText = row.Review || row.review || "";
            const liked = (row.Liked || row.liked || "").toString().toLowerCase() === "yes" ||
                          (row.Liked || row.liked || "").toString().toLowerCase() === "true";
            const isRewatch = (row.Rewatch || row.rewatch || "").toString().toLowerCase() === "yes" ||
                              (row.Rewatch || row.rewatch || "").toString().toLowerCase() === "true";

            // Mark as watched (idempotent via merge)
            if (!existing.watched.has(mediaId)) {
                operations.push({
                    type: "set",
                    collection: "user_watched",
                    docId,
                    data: {
                        userId,
                        mediaId: Number(mediaId),
                        mediaType: "movie",
                        title: tmdbData.title || "",
                        poster_path: tmdbData.poster_path || "",
                        addedAt: serverTimestamp(),
                        importedFrom: "letterboxd",
                    },
                });
                existing.watched.add(mediaId); // Track locally
            }

            // Save rating/review if present
            if (rating > 0 || reviewText) {
                const ratingDocId = `${userId}_movie_${mediaId}`;
                if (!existing.ratings.has(ratingDocId)) {
                    const ratingData = {
                        userId,
                        mediaId: Number(mediaId),
                        mediaType: "movie",
                        title: tmdbData.title || "",
                        poster_path: tmdbData.poster_path || "",
                        username,
                        ratedAt: serverTimestamp(),
                        importedFrom: "letterboxd",
                    };
                    if (rating > 0) ratingData.rating = rating;
                    if (reviewText) ratingData.review = reviewText;
                    if (watchedDate) ratingData.watchedDate = watchedDate;
                    if (liked) ratingData.liked = true;
                    if (isRewatch) {
                        ratingData.isRewatch = true;
                        ratingData.viewCount = 2;
                    }

                    operations.push({
                        type: "set",
                        collection: "user_ratings",
                        docId: ratingDocId,
                        data: ratingData,
                    });
                    existing.ratings.add(ratingDocId);
                }
            }

            summary.diary.imported++;
        }
    }

    // ── Import Ratings (standalone, not from diary) ──
    if (parsed.ratings) {
        summary.ratings.total = parsed.ratings.length;
        onProgress({ phase: "import", current: 0, total: parsed.ratings.length, message: "Importing ratings..." });

        for (const row of parsed.ratings) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.ratings.failed++; continue; }
            const mediaId = tmdbData.id;
            const rating = normalizeRating(row.Rating || row.rating || 0);
            if (rating <= 0) { summary.ratings.skipped++; continue; }

            const ratingDocId = `${userId}_movie_${mediaId}`;
            if (existing.ratings.has(ratingDocId)) {
                summary.ratings.skipped++;
                continue;
            }

            operations.push({
                type: "set",
                collection: "user_ratings",
                docId: ratingDocId,
                data: {
                    userId,
                    mediaId: Number(mediaId),
                    mediaType: "movie",
                    rating,
                    title: tmdbData.title || "",
                    poster_path: tmdbData.poster_path || "",
                    username,
                    ratedAt: serverTimestamp(),
                    importedFrom: "letterboxd",
                },
            });

            // Also mark as watched
            if (!existing.watched.has(mediaId)) {
                operations.push({
                    type: "set",
                    collection: "user_watched",
                    docId: `${userId}_movie_${mediaId}`,
                    data: {
                        userId,
                        mediaId: Number(mediaId),
                        mediaType: "movie",
                        title: tmdbData.title || "",
                        poster_path: tmdbData.poster_path || "",
                        addedAt: serverTimestamp(),
                        importedFrom: "letterboxd",
                    },
                });
                existing.watched.add(mediaId);
            }

            existing.ratings.add(ratingDocId);
            summary.ratings.imported++;
        }
    }

    // ── Import Reviews ──
    if (parsed.reviews) {
        summary.reviews.total = parsed.reviews.length;
        onProgress({ phase: "import", current: 0, total: parsed.reviews.length, message: "Importing reviews..." });

        for (const row of parsed.reviews) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.reviews.failed++; continue; }
            const mediaId = tmdbData.id;
            const reviewText = row.Review || row.review || "";
            if (!reviewText) { summary.reviews.skipped++; continue; }

            const rating = normalizeRating(row.Rating || row.rating || 0);
            const ratingDocId = `${userId}_movie_${mediaId}`;
            const watchedDate = parseDate(row["Watched Date"] || row.Date || row.date);

            // Merge review into existing rating doc
            const reviewData = {
                userId,
                mediaId: Number(mediaId),
                mediaType: "movie",
                title: tmdbData.title || "",
                poster_path: tmdbData.poster_path || "",
                review: reviewText,
                username,
                ratedAt: serverTimestamp(),
                importedFrom: "letterboxd",
            };
            if (rating > 0) reviewData.rating = rating;
            if (watchedDate) reviewData.watchedDate = watchedDate;

            operations.push({
                type: "set",
                collection: "user_ratings",
                docId: ratingDocId,
                data: reviewData,
            });

            existing.ratings.add(ratingDocId);
            summary.reviews.imported++;
        }
    }

    // ── Import Likes ──
    if (parsed.likes) {
        summary.likes.total = parsed.likes.length;
        onProgress({ phase: "import", current: 0, total: parsed.likes.length, message: "Importing likes..." });

        for (const row of parsed.likes) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.likes.failed++; continue; }
            const mediaId = tmdbData.id;
            const ratingDocId = `${userId}_movie_${mediaId}`;

            // Update existing rating doc with liked=true, or create minimal one
            const likeData = {
                userId,
                mediaId: Number(mediaId),
                mediaType: "movie",
                title: tmdbData.title || "",
                poster_path: tmdbData.poster_path || "",
                liked: true,
                username,
                importedFrom: "letterboxd",
            };

            // Only add ratedAt if creating new doc
            if (!existing.ratings.has(ratingDocId)) {
                likeData.ratedAt = serverTimestamp();
            }

            operations.push({
                type: "set",
                collection: "user_ratings",
                docId: ratingDocId,
                data: likeData,
            });

            existing.ratings.add(ratingDocId);
            summary.likes.imported++;
        }
    }

    // ── Import Watchlist ──
    if (parsed.watchlist) {
        summary.watchlist.total = parsed.watchlist.length;
        onProgress({ phase: "import", current: 0, total: parsed.watchlist.length, message: "Importing watchlist..." });

        for (const row of parsed.watchlist) {
            const tmdbData = getTMDB(row);
            if (!tmdbData) { summary.watchlist.failed++; continue; }
            const mediaId = tmdbData.id;

            // Skip if already watched or in watchlist
            if (existing.watched.has(mediaId) || existing.watchlist.has(mediaId)) {
                summary.watchlist.skipped++;
                continue;
            }

            const docId = `${userId}_movie_${mediaId}`;
            operations.push({
                type: "set",
                collection: "user_watchlist",
                docId,
                data: {
                    userId,
                    mediaId: Number(mediaId),
                    mediaType: "movie",
                    title: tmdbData.title || "",
                    poster_path: tmdbData.poster_path || "",
                    addedAt: serverTimestamp(),
                    importedFrom: "letterboxd",
                },
            });

            existing.watchlist.add(mediaId);
            summary.watchlist.imported++;
        }
    }

    // ── Import Lists ──
    if (parsed.listFiles && parsed.listFiles.length > 0) {
        summary.lists.total = parsed.listFiles.length;
        onProgress({ phase: "import", current: 0, total: parsed.listFiles.length, message: "Importing lists..." });

        for (const listFile of parsed.listFiles) {
            try {
                // Create list document
                const listRef = doc(collection(db, "user_lists"));
                const listItems = [];

                for (const row of listFile.items) {
                    const tmdbData = getTMDB(row);
                    if (!tmdbData) continue;
                    listItems.push({
                        mediaId: Number(tmdbData.id),
                        mediaType: "movie",
                        title: tmdbData.title || "",
                        poster_path: tmdbData.poster_path || "",
                    });
                }

                if (listItems.length > 0) {
                    await setDoc(listRef, {
                        userId,
                        username,
                        title: listFile.name.replace(/(^|\s)\S/g, (m) => m.toUpperCase()), // Title case
                        description: `Imported from Letterboxd`,
                        items: listItems,
                        isPublic: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        importedFrom: "letterboxd",
                    });
                    summary.lists.imported++;
                } else {
                    summary.lists.failed++;
                }
            } catch (err) {
                summary.lists.failed++;
                summary.errors.push(`Failed to import list "${listFile.name}": ${err.message}`);
            }
        }
    }

    // Phase 6: Commit all operations
    if (operations.length > 0) {
        const totalOps = operations.length;
        onProgress({ phase: "commit", current: 0, total: totalOps, message: `Saving ${totalOps} records to database...` });

        try {
            await commitBatches(operations);
            onProgress({ phase: "commit", current: totalOps, total: totalOps, message: "All records saved!" });
        } catch (err) {
            summary.errors.push(`Database write error: ${err.message}`);
            throw new Error(`Failed to write to database: ${err.message}`);
        }
    }

    // Save import record for tracking/re-import protection
    try {
        await setDoc(doc(db, "user_imports", `${userId}_letterboxd`), {
            userId,
            source: "letterboxd",
            importedAt: serverTimestamp(),
            summary: {
                watched: summary.watched.imported,
                ratings: summary.ratings.imported,
                reviews: summary.reviews.imported,
                likes: summary.likes.imported,
                watchlist: summary.watchlist.imported,
                lists: summary.lists.imported,
                diary: summary.diary.imported,
                tmdbMatches: summary.tmdbMatches,
                tmdbMisses: summary.tmdbMisses,
                errorCount: summary.errors.length,
            },
        }, { merge: true });
    } catch (_) {
        // Non-critical
    }

    // Emit events to refresh UI
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
        const snap = await getDoc(doc(db, "user_imports", `${userId}_letterboxd`));
        if (snap.exists()) return snap.data();
        return null;
    } catch {
        return null;
    }
}
