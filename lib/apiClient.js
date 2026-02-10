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

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    try {
        const response = await fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000), // 10s timeout
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
        if (retries > 0 && error.name !== "AbortError") {
            console.warn(`Retrying ${url}, attempts left: ${retries - 1}`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

export const apiClient = {
    async get(endpoint, options = {}) {
        const url = endpoint.startsWith("http")
            ? endpoint
            : `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${endpoint}`;

        try {
            return await fetchWithRetry(url, { ...options, method: "GET" });
        } catch (error) {
            console.error("API GET Error:", error);
            throw error;
        }
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
