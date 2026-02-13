/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./pages/**/*.{js,jsx}",
        "./components/**/*.{js,jsx}",
        "./app/**/*.{js,jsx}",
    ],
    theme: {
        container: {
            center: true,
            padding: {
                DEFAULT: "1.5rem",
                md: "2rem",
                lg: "2.5rem",
            },
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                background: "#0F1115",
                secondary: "#1A1D24",
                accent: "#4169E1",
                warning: "#FF5C5C",
                textPrimary: "#FFFFFF",
                textSecondary: "#B0B3C0",
            },
        },
    },
    plugins: [],
};
