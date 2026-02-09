import type { Config } from "tailwindcss";

export default {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0F1115",
                secondary: "#1A1D24",
                accent: "#00C896",
                warning: "#FF5C5C",
                textPrimary: "#FFFFFF",
                textSecondary: "#B0B3C0",
            },
        },
    },
    plugins: [],
} satisfies Config;
