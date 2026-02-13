const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_TMDB_API_KEY=(.+)/);
    if (match) apiKey = match[1].trim();
} catch (e) { }

const candidates = [
    "https://api.themoviedb.org/3",
    "https://api.tmdb.org/3", // Alternate
    "http://api.themoviedb.org/3", // Non-SSL (might be blocked/redirected but worth try)
];

async function testCandidate(baseUrl) {
    const url = `${baseUrl}/movie/popular?api_key=${apiKey}`;
    console.log(`Testing: ${baseUrl}...`);
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
            console.log(`✅ SUCCESS: ${baseUrl}`);
            return true;
        } else {
            console.log(`❌ FAILED: ${baseUrl} (${res.status})`);
        }
    } catch (e) {
        console.log(`❌ FAILED: ${baseUrl} (${e.message})`);
    }
    return false;
}

async function run() {
    for (const c of candidates) {
        if (await testCandidate(c)) {
            console.log(`\nRECOMMENDATION: Use ${c}`);
            process.exit(0);
        }
    }
    console.log("\nALL FAILED.");
    process.exit(1);
}

run();
