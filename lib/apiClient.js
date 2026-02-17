class APIError extends Error {
    constructor(message, status, endpoint) {
        super(message);
        this.name = "APIError";
        this.status = status;
        this.endpoint = endpoint;
    }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// In-flight request deduplication for GET requests
const inflightRequests = new Map();

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    // Only retry idempotent methods (GET, PUT, DELETE) — never retry POST to prevent duplicate writes
    const method = (options.method || 'GET').toUpperCase();
    const canRetry = method !== 'POST';
    const maxRetries = canRetry ? retries : 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: options.signal || AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                throw new APIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    url
                );
            }

            return await response.json();
        } catch (error) {
            if (attempt < maxRetries && error.name !== 'AbortError') {
                console.warn(`Retrying ${url}, attempts left: ${maxRetries - attempt - 1}`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
                continue;
            }
            throw error;
        }
    }
}

export const apiClient = {
    async get(endpoint, options = {}) {
        const url = endpoint.startsWith("http")
            ? endpoint
            : `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${endpoint}`;

        // Deduplicate concurrent identical GET requests
        if (inflightRequests.has(url)) {
            return inflightRequests.get(url);
        }

        const promise = fetchWithRetry(url, { ...options, method: "GET" })
            .catch((error) => {
                console.error("API GET Error:", error);
                throw error;
            })
            .finally(() => {
                inflightRequests.delete(url);
            });

        inflightRequests.set(url, promise);
        return promise;
    },

    async post(endpoint, data, options = {}) {
        const url = endpoint.startsWith("http")
            ? endpoint
            : `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${endpoint}`;

        try {
            return await fetchWithRetry(url, {
                ...options,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error("API POST Error:", error);
            throw error;
        }
    },
};

export { APIError };
