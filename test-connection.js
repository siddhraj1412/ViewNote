const fs = require('fs');
const path = require('path');

// Read .env.local manually since we're running with node, not next
const envPath = path.resolve(__dirname, '.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_TMDB_API_KEY=(.+)/);
    if (match) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.local");
    process.exit(1);
}

if (!apiKey) {
    console.error("API Key not found in .env.local");
    process.exit(1);
}

console.log("Found API Key (masked):", apiKey.substring(0, 5) + "...");

async function testConnection() {
    const url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}`;
    console.log(`Testing URL: ${url.replace(apiKey, 'API_KEY')}`);

    const start = Date.now();
    try {
        const res = await fetch(url);
        const duration = Date.now() - start;
        console.log(`Status: ${res.status}`);
        console.log(`Duration: ${duration}ms`);

        if (res.ok) {
            const data = await res.json();
            console.log("Success! Found", data.results?.length, "movies.");
        } else {
            console.error("Error:", res.statusText);
            const text = await res.text();
            console.error("Response:", text);
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
        if (e.cause) console.error("Cause:", e.cause);
    }
}

testConnection();
