/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./pages/**/*.{js,jsx}",
        "./components/**/*.{js,jsx}",
        "./app/**/*.{js,jsx}",
    ],
    theme: {
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
