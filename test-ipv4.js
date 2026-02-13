const dns = require('dns');
const https = require('https');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

console.log("Testing connectivity with IPv4 preferred...");

const options = {
    hostname: 'api.themoviedb.org',
    port: 443,
    path: '/3/configuration?api_key=' + process.env.NEXT_PUBLIC_TMDB_API_KEY, // We need to read env manually if not loaded
    method: 'GET',
    family: 4 // Force IPv4
};

// Simple manual read of env since we can't depend on process.env being populated by next here
const fs = require('fs');
const path = require('path');
let apiKey = '';
try {
    const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_TMDB_API_KEY=(.+)/);
    if (match) apiKey = match[1].trim();
} catch (e) { }

if (apiKey) {
    options.path = `/3/configuration?api_key=${apiKey}`;
} else {
    console.log("No API Key found, testing without (expect 401)");
}

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
